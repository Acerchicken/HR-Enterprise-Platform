# PostgreSQL 16 (Alpine, như trước) thêm extension pgvector cho trợ lý chính sách (UC6, ADR-16).
# Giữ cùng bản Alpine với image cũ để volume db-data hiện có dùng tiếp được (đổi sang image Debian có thể lệch collation).
# Staging dùng RDS PostgreSQL 16, đã có sẵn pgvector, không cần image này.
FROM postgres:16-alpine

ARG PGVECTOR_VERSION=0.8.0
ADD https://github.com/pgvector/pgvector/archive/refs/tags/v${PGVECTOR_VERSION}.tar.gz /tmp/pgvector.tar.gz

# with_llvm=no: không biên dịch bitcode JIT, nên không cần clang/llvm. OPTFLAGS rỗng: không dùng -march=native,
# để image build trên máy này chạy được trên máy khác.
RUN apk add --no-cache --virtual .build-deps build-base \
 && mkdir -p /tmp/pgvector && tar -xzf /tmp/pgvector.tar.gz -C /tmp/pgvector --strip-components=1 \
 && make -C /tmp/pgvector OPTFLAGS="" with_llvm=no \
 && make -C /tmp/pgvector install with_llvm=no \
 && rm -rf /tmp/pgvector /tmp/pgvector.tar.gz \
 && apk del .build-deps
