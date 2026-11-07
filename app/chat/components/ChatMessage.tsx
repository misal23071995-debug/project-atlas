import type { ChatMessage } from "../types";

type Props = {
  message: ChatMessage;
  onCreateTicket?: (message: ChatMessage) => void;
};

export default function ChatMessage({ message, onCreateTicket }: Props) {
  const isUser = message.role === "user";
  const confidence = message.analysis?.confidence ?? 0;
  const confidenceColor =
  confidence >= 85
    ? "bg-green-500/20 text-green-600"
    : confidence >= 60
    ? "bg-yellow-500/20 text-yellow-600"
    : "bg-red-500/20 text-red-600";
  const needsEscalation = confidence < 60;

    return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[75%] rounded-xl bg-blue-600 px-4 py-3"
            : "max-w-[75%] rounded-xl bg-zinc-100 px-4 py-3"
        }
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <>
            <h3 className="mb-2 font-semibold">🤖 Atlas AI</h3>

            <p>{message.analysis?.suggestedReply}</p>

            <div className="mt-3 space-y-1 text-sm text-zinc-700">
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
            {needsEscalation && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-sm font-semibold text-red-600">
                  ⚠ AI recommends human escalation
                </p>

                <p className="mt-1 text-xs text-red-700">
                  Confidence is low. Review this conversation before sending a reply.
                </p>
              </div>
            )}
            <div className="mt-4">
              <h4 className="mb-2 font-medium">Helpful Articles</h4>

              <ul className="list-disc pl-5 text-sm">
                {message.analysis?.relatedArticles.map((article) => (
                  <li key={article}>{article}</li>
                ))}
              </ul>
            </div>
            {message.role === "assistant" && onCreateTicket && (
              <div className="mt-4">
                <button
                  onClick={() => onCreateTicket(message)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700 transition"
                >
                  Create Support Ticket
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}