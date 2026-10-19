// Chọn LLM và tự chuyển sang nhà cung cấp dự phòng khi lỗi.
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";

// Tạo model của một nhà cung cấp. temperature 0 để câu trả lời ổn định, ít "sáng tạo"
// (ta cần agent làm đúng luật chứ không cần viết hay).
function createModel(provider) {
  if (provider === "groq") {
    return new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0,
    });
  }
  return new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    temperature: 0,
  });
}

// Gọi LLM với danh sách tool. Thử nhà cung cấp chính (LLM_PROVIDER) trước, lỗi thì thử nhà còn lại.
// Cả hai lỗi thì ném Error có code LLM_UNAVAILABLE.
// Ghi chú: ta chuyển dự phòng với MỌI lỗi (429, 5xx, và cả sai API key) để L6 chạy được.
export async function callModel(messages, tools) {
  const primary = process.env.LLM_PROVIDER === "groq" ? "groq" : "gemini";
  const backup = primary === "gemini" ? "groq" : "gemini";

  const reasons = [];
  for (const provider of [primary, backup]) {
    try {
      // bindTools: gửi kèm tên, mô tả, schema của tool cho LLM để nó biết có thể gọi tool nào.
      const modelWithTools = createModel(provider).bindTools(tools);
      return await modelWithTools.invoke(messages);
    } catch (err) {
      reasons.push(`${provider}: ${err.message}`);
    }
  }

  const error = new Error(`AI tạm thời không trả lời được (${reasons.join(" | ")})`);
  error.code = "LLM_UNAVAILABLE";
  throw error;
}
