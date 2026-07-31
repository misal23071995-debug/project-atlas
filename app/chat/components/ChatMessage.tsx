import type { ChatMessage as ChatMessageType } from "../types";

type Props = {
  message: ChatMessageType;
};

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";
  const confidence = message.analysis?.confidence ?? 0;
  const confidenceColor =
  confidence >= 85
    ? "bg-green-500/20 text-green-400"
    : confidence >= 60
    ? "bg-yellow-500/20 text-yellow-400"
    : "bg-red-500/20 text-red-400";

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[75%] rounded-xl bg-blue-600 px-4 py-3"
            : "max-w-[75%] rounded-xl bg-zinc-800 px-4 py-3"
        }
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <>
            <h3 className="mb-2 font-semibold">🤖 Atlas AI</h3>

            <p>{message.analysis?.suggestedReply}</p>

            <div className="mt-3 space-y-1 text-sm text-zinc-300">
              <p>
                <strong>Intent:</strong> {message.analysis?.intent}
              </p>

              <p>
                <strong>Sentiment:</strong> {message.analysis?.sentiment}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <span className="font-semibold text-sm">
                  Confidence:
                </span>

                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${confidenceColor}`}
                >
                  {confidence}%
                </span>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="mb-2 font-medium">Helpful Articles</h4>

              <ul className="list-disc pl-5 text-sm">
                {message.analysis?.relatedArticles.map((article) => (
                  <li key={article}>{article}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}