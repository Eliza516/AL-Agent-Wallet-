// Định nghĩa 3 tool cho LLM. LLM chỉ "chọn" tool; code ở đây mới là thứ chạy tool.
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Schema NGHIÊM để kiểm tra tham số LLM đưa (đây là lớp Zod trong bảng mã INVALID_INPUT).
const payInput = z.object({
  to: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "to phải là 0x + 40 ký tự hex"),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "amount phải là số thập phân dương, tối đa 6 chữ số sau dấu chấm")
    .refine((s) => Number(s) > 0, "amount phải lớn hơn 0"),
  ref: z
    .string()
    .min(1)
    .max(31, "ref tối đa 31 ký tự")
    .regex(/^[\x20-\x7E]+$/, "ref chỉ gồm ký tự ASCII"),
});

// Schema ĐƠN GIẢN gửi cho LLM (chỉ tên + mô tả), vì mỗi nhà cung cấp hiểu JSON Schema
// hơi khác nhau; việc kiểm tra thật nằm trong func ở trên nên không mất an toàn.
const payShape = z.object({
  to: z.string().describe("Địa chỉ người nhận, dạng 0x + 40 ký tự hex"),
  amount: z.string().describe('Số tiền theo coin dạng chuỗi thập phân, ví dụ "0.002"'),
  ref: z.string().describe('Mã tham chiếu ASCII tối đa 31 ký tự, ví dụ "req-17"'),
});

const emptyShape = z.object({});

// Tool KHÔNG throw: luôn trả về JSON string để LLM đọc.
export function makeTools(chain) {
  const getWalletStatus = tool(
    async () => {
      try {
        return JSON.stringify({ ok: true, data: await chain.getWalletStatus() });
      } catch (err) {
        return JSON.stringify({ ok: false, code: "RPC_ERROR", message: err.message });
      }
    },
    {
      name: "get_wallet_status",
      description:
        "Lấy số liệu ví hiện tại: số dư, hạn mức mỗi giao dịch, hạn mức ngày, đã chi hôm nay, còn lại hôm nay, trạng thái pause. " +
        "Dùng mỗi khi cần số liệu và LUÔN gọi trước khi pay.",
      schema: emptyShape,
    }
  );

  const listServices = tool(
    async () => {
      try {
        return JSON.stringify({ ok: true, data: await chain.listServices() });
      } catch (err) {
        return JSON.stringify({ ok: false, code: "RPC_ERROR", message: err.message });
      }
    },
    {
      name: "list_services",
      description:
        "Liệt kê các dịch vụ có thể mua (id, tên, giá, địa chỉ payTo). " +
        "Dùng khi người dùng muốn mua dữ liệu/dịch vụ để lấy đúng payTo và giá.",
      schema: emptyShape,
    }
  );

  const pay = tool(
    async (input) => {
      const parsed = payInput.safeParse(input);
      if (!parsed.success) {
        return JSON.stringify({
          ok: false,
          code: "INVALID_INPUT",
          message: parsed.error.issues.map((i) => i.message).join("; "),
        });
      }
      try {
        return JSON.stringify(await chain.pay(parsed.data));
      } catch (err) {
        return JSON.stringify({ ok: false, code: "RPC_ERROR", message: err.message });
      }
    },
    {
      name: "pay",
      description:
        "Trả tiền từ ví cho một địa chỉ. Chỉ dùng sau khi đã gọi get_wallet_status, " +
        "và chỉ với payTo lấy từ list_services hoặc địa chỉ người dùng đưa rõ ràng. " +
        "Kết quả có txHash nghĩa là đã trả; không có txHash nghĩa là CHƯA trả.",
      schema: payShape,
    }
  );

  return [getWalletStatus, listServices, pay];
}
