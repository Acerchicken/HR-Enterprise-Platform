import { Pool } from 'pg';
import { Passage } from '../llm/prompt';
import { Embedder, toPgVector } from './embedders/embedder';
import { RAG_SETTINGS } from './settings';

/**
 * Truy hồi lai (ADR-16 mục 5): full-text (`unaccent`, `simple`) và vector, **cả hai câu SQL đều lọc phạm vi** trước khi xếp
 * hạng, gộp bằng Reciprocal Rank Fusion, bỏ đoạn không qua ngưỡng liên quan, lấy tối đa `maxPassages` đoạn.
 * Phạm vi do API tính (đơn vị hiện tại và các đơn vị cha, vai trò); API không gọi tới đây khi người hỏi không có hồ sơ.
 */
export interface Scope {
  unitIds: string[];
  roles: string[];
}

interface Row {
  id: string;
  document_id: string;
  heading: string;
  content: string;
  title: string;
  version_no: number;
}

interface Candidate extends Row {
  rrf: number;
  pass: boolean;
}

export type RetrievalSettings = typeof RAG_SETTINGS;

const SCOPE_SQL = `NOT d.hidden AND d.index_status = 'INDEXED' AND c.version_id = d.version_id
  AND (d.scope_all OR d.scope_department_ids && $SCOPE_UNITS::uuid[] OR d.scope_roles && $SCOPE_ROLES::text[])`;

/** Tách câu hỏi thành từ (chữ, số), chữ thường, bỏ trùng; chỉ còn chữ và số nên không phá được cú pháp `to_tsquery`. */
export function queryTerms(question: string, max = 30): string[] {
  const words = question.normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return [...new Set(words)].slice(0, max);
}

export class Retriever {
  constructor(
    private readonly pool: Pool,
    private readonly embedder: Embedder,
    private readonly settings: RetrievalSettings = RAG_SETTINGS,
  ) {
    if (!/^[a-z0-9.-]+$/.test(embedder.id) || !Number.isInteger(embedder.dimensions)) throw new Error('Embedder id hoặc số chiều không hợp lệ');
  }

  async retrieve(question: string, scope: Scope): Promise<Passage[]> {
    const s = this.settings;
    const terms = queryTerms(question);
    const [fts, vec] = await Promise.all([
      terms.length ? this.fullText(terms, scope) : Promise.resolve([] as Array<Row & { coverage: number }>),
      s.vectorEnabled ? this.vector(question, scope) : Promise.resolve([] as Array<Row & { similarity: number }>),
    ]);
    const minSim = s.minSimilarity[this.embedder.id] ?? Number.POSITIVE_INFINITY;
    const byId = new Map<string, Candidate>();
    const add = (r: Row, rank: number, pass: boolean) => {
      const c = byId.get(r.id) ?? { ...r, rrf: 0, pass: false };
      c.rrf += 1 / (s.rrfK + rank + 1);
      c.pass ||= pass;
      byId.set(r.id, c);
    };
    fts.forEach((r, i) => add(r, i, r.coverage >= s.minTermCoverage));
    vec.forEach((r, i) => add(r, i, r.similarity >= minSim));
    return [...byId.values()]
      .filter((c) => c.pass)
      .sort((a, b) => b.rrf - a.rrf || Number(a.id) - Number(b.id))
      .slice(0, s.maxPassages)
      .map((c, i) => ({
        n: i + 1,
        chunkId: c.id,
        documentId: c.document_id,
        versionNo: c.version_no,
        title: c.title,
        section: c.heading,
        content: c.content,
      }));
  }

  private async fullText(terms: string[], scope: Scope): Promise<Array<Row & { coverage: number }>> {
    const sql = `
      WITH q AS (SELECT to_tsquery('simple', unaccent($1)) AS tq)
      SELECT c.id, c.document_id, c.heading, c.content, d.title, d.version_no,
             (SELECT count(*) FROM unnest($2::text[]) t WHERE c.tsv @@ plainto_tsquery('simple', unaccent(t)))::float
               / cardinality($2::text[]) AS coverage
      FROM assistant.chunk c JOIN assistant.document d ON d.id = c.document_id, q
      WHERE c.tsv @@ q.tq AND ${SCOPE_SQL.replace('$SCOPE_UNITS', '$3').replace('$SCOPE_ROLES', '$4')}
      ORDER BY ts_rank_cd(c.tsv, q.tq) DESC, c.id
      LIMIT $5`;
    const { rows } = await this.pool.query(sql, [terms.join(' | '), terms, scope.unitIds, scope.roles, this.settings.perBranch]);
    return rows;
  }

  private async vector(question: string, scope: Scope): Promise<Array<Row & { similarity: number }>> {
    const q = toPgVector(await this.embedder.embedQuery(question));
    // Model và số chiều viết thẳng vào câu (đã kiểm ở constructor) để khớp điều kiện của chỉ mục HNSW một phần.
    const expr = `e.embedding::vector(${this.embedder.dimensions})`;
    const sql = `
      SELECT c.id, c.document_id, c.heading, c.content, d.title, d.version_no,
             1 - (${expr} <=> $1::vector(${this.embedder.dimensions})) AS similarity
      FROM assistant.chunk_embedding e
      JOIN assistant.chunk c ON c.id = e.chunk_id
      JOIN assistant.document d ON d.id = c.document_id
      WHERE e.model = '${this.embedder.id}' AND ${SCOPE_SQL.replace('$SCOPE_UNITS', '$2').replace('$SCOPE_ROLES', '$3')}
      ORDER BY ${expr} <=> $1::vector(${this.embedder.dimensions})
      LIMIT $4`;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL hnsw.ef_search = ${Math.trunc(this.settings.efSearch)}`);
      const { rows } = await client.query(sql, [q, scope.unitIds, scope.roles, this.settings.perBranch]);
      await client.query('COMMIT');
      return rows;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }
}
