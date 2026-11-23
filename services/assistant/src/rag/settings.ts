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
} as const;
