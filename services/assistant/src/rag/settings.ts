/**
 * Tham số chia đoạn và truy hồi (ADR-16 mục 4): chỉnh theo bộ câu hỏi đánh giá của TV2 mà không sửa code.
 * Đổi độ dài đoạn, độ chồng thì phải chạy lại lệnh đồng bộ lần đầu (`npm run assistant:sync` ở backend) để chia lại đoạn.
 */
export const RAG_SETTINGS = {
  /** Độ dài tối đa một đoạn (ký tự). EmbeddingGemma nhận tối đa 2.048 token, 1.500 ký tự tiếng Việt khoảng 500 token. */
  chunkChars: 1500,
  /** Phần cuối đoạn trước được lặp lại ở đầu đoạn sau, để ý nằm giữa hai đoạn vẫn tìm được. */
  overlapChars: 200,
  /** Số đoạn tính embedding mỗi lượt (giữ bộ nhớ thấp trên task 2 GB). */
  embedBatch: 8,

  // ---- Truy hồi (ADR-16 mục 5) ----
  /** Số đoạn lấy theo mỗi nhánh (full-text, vector) trước khi gộp. */
  perBranch: 20,
  /** Số đoạn tối đa gửi LLM. */
  maxPassages: 6,
  /** Hằng số k của Reciprocal Rank Fusion: điểm = Σ 1 / (k + hạng). */
  rrfK: 60,
  /** Tắt nhánh vector (phương án cắt của ADR-16: chỉ full-text). */
  vectorEnabled: true,
  /** Đoạn qua nhánh full-text khi khớp ít nhất tỉ lệ này số từ của câu hỏi (sau khi bỏ dấu). */
  minTermCoverage: 0.5,
  /**
   * Độ giống cosine tối thiểu để đoạn qua nhánh vector, theo model (mỗi model có thang khác nhau). Model không có trong bảng
   * thì nhánh vector không tự cho đoạn qua ngưỡng, chỉ góp thứ hạng. Chỉnh theo bộ đánh giá.
   */
  minSimilarity: { 'embeddinggemma-300m': 0.45, 'hash-256': 0.3 } as Record<string, number>,
  /** Số lượt `hnsw.ef_search` khi truy vấn vector có lọc phạm vi (lọc sau HNSW nên cần lấy rộng hơn). */
  efSearch: 100,
};
