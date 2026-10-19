import { useState, useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import { aiService, type AiChatMessage, type AiCitation } from "../services/aiService";

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialProjectId?: string;
}

export function AiAssistantDrawer({ isOpen, onClose, initialProjectId }: AiAssistantDrawerProps) {
  const { session } = useAuth();
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I am your SEVENTS Construction Knowledge Assistant. Ask me anything about project drawings, contracts, RFIs, specifications, or DPRs. All answers are strictly grounded in authorized project documentation with exact citations.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<string>(initialProjectId || "");
  const [selectedCitation, setSelectedCitation] = useState<AiCitation | null>(null);
  const [feedbackSuccessId, setFeedbackSuccessId] = useState<string | null>(null);
  const [reportGapQuery, setReportGapQuery] = useState<string | null>(null);
  const [gapComment, setGapComment] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Keyboard shortcut ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading || !session?.access_token) return;

    const userMsg: AiChatMessage = {
      id: "user-" + Date.now(),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Build history
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await aiService.chat(
        session.access_token,
        query,
        projectId || undefined,
        history
      );

      const assistantMsg: AiChatMessage = {
        id: "ai-" + Date.now(),
        role: "assistant",
        content: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        citations: res.citations,
        confidence: res.confidence,
        abstain: res.abstain,
        abstainReason: res.abstainReason,
        model: res.model,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: AiChatMessage = {
        id: "err-" + Date.now(),
        role: "assistant",
        content: `Error retrieving response: ${err.message || "Failed to communicate with AI Assistant service"}. Please ensure backend AI service is running and permissions are granted.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        abstain: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (
    msg: AiChatMessage,
    rating: 1 | -1,
    isGap: boolean = false,
    comment?: string
  ) => {
    if (!session?.access_token) return;
    try {
      await aiService.submitFeedback(session.access_token, {
        queryText: messages[messages.indexOf(msg) - 1]?.content || "User Query",
        responseText: msg.content,
        rating,
        comment,
        isKnowledgeGap: isGap,
      });
      setFeedbackSuccessId(msg.id);
      setTimeout(() => setFeedbackSuccessId(null), 3000);
      setReportGapQuery(null);
      setGapComment("");
    } catch (err) {
      console.error("Failed to submit feedback", err);
    }
  };

  const samplePrompts = [
    "What are the basement slab waterproofing specs?",
    "What is the concrete compressive strength for Tower columns?",
    "What is the required turnaround time for urgent RFIs?",
    "Summarize safety protocols for scaffolding works",
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity">
      <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200 border-l border-zinc-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 bg-zinc-900 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-zinc-900 shadow-sm">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">AI Knowledge Assistant</h2>
                <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-semibold text-brand uppercase tracking-wider">
                  Grounded RAG
                </span>
              </div>
              <p className="text-xs text-zinc-400">Strictly grounded in project drawings, RFIs &amp; contracts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setMessages([
                  {
                    id: "welcome-reset",
                    role: "assistant",
                    content: "Chat cleared. What can I help you find across project documentation?",
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  },
                ]);
              }}
              title="Clear conversation"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={onClose}
              title="Close drawer (Esc)"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Project Scope Filter Banner */}
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-6 py-2.5 text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="font-medium text-zinc-700">Project Scope:</span>
          </div>
          <input
            type="text"
            placeholder="All projects (or enter Project ID)"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-56 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 placeholder-zinc-400 focus:border-brand focus:outline-none"
          />
        </div>

        {/* Conversation Message List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-stone-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              {/* Message Header */}
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[11px] font-medium text-zinc-400">
                  {msg.role === "user" ? "You" : "SEVENTS Assistant"}
                </span>
                <span className="text-[10px] text-zinc-400">{msg.timestamp}</span>
                {msg.model && (
                  <span className="rounded bg-zinc-200/80 px-1.5 py-0.2 text-[9px] font-mono text-zinc-600">
                    {msg.model}
                  </span>
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[92%] shadow-xs ${
                  msg.role === "user"
                    ? "bg-zinc-900 text-white rounded-tr-xs"
                    : "bg-white text-zinc-800 border border-zinc-200/80 rounded-tl-xs"
                }`}
              >
                {/* Abstain Warning Banner per BRD FR-AI-003 */}
                {msg.abstain && (
                  <div className="mb-2.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-800 mb-0.5">
                      <svg className="h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Strict Abstention Guardrail Active
                    </div>
                    {msg.abstainReason ||
                      "Insufficient evidence in indexed documents to confirm this inquiry. To prevent safety or contractual risks, SEVENTS AI abstains from speculating."}
                  </div>
                )}

                {/* Text Content */}
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Citations Section per BRD FR-AI-001 */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-zinc-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                        Verified Sources ({msg.citations.length})
                      </span>
                      {msg.confidence !== undefined && (
                        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {Math.round(msg.confidence * 100)}% match confidence
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {msg.citations.map((c, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedCitation(c)}
                          className="group inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-left text-xs font-medium text-zinc-700 hover:border-brand hover:bg-amber-50/50 hover:text-zinc-900 transition-all"
                        >
                          <span className="rounded bg-zinc-200 px-1 py-0.2 text-[9px] font-bold uppercase text-zinc-700 group-hover:bg-brand">
                            {c.sourceType}
                          </span>
                          <span className="max-w-[170px] truncate">{c.title}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">({c.version})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assistant Action / Feedback Row */}
                {msg.role === "assistant" && msg.id !== "welcome" && (
                  <div className="mt-3 pt-2 flex items-center justify-between border-t border-zinc-50 text-xs text-zinc-400">
                    <span className="text-[10px]">Was this answer accurate?</span>
                    <div className="flex items-center gap-1">
                      {feedbackSuccessId === msg.id ? (
                        <span className="text-[11px] text-emerald-600 font-medium">Thank you for your feedback!</span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleFeedback(msg, 1)}
                            title="Helpful & accurate"
                            className="p-1 rounded hover:bg-zinc-100 hover:text-emerald-600 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleFeedback(msg, -1)}
                            title="Inaccurate or outdated"
                            className="p-1 rounded hover:bg-zinc-100 hover:text-rose-600 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76 1.04m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setReportGapQuery(msg.id)}
                            title="Report missing documentation"
                            className="ml-2 text-[11px] underline text-zinc-500 hover:text-zinc-800"
                          >
                            Report missing info
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Report Missing Info Drawer Inline */}
                {reportGapQuery === msg.id && (
                  <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <p className="text-xs font-semibold text-zinc-800 mb-1">
                      Flag Documentation Gap for Project Engineers
                    </p>
                    <textarea
                      rows={2}
                      value={gapComment}
                      onChange={(e) => setGapComment(e.target.value)}
                      placeholder="Specify which drawing or specification revision is missing..."
                      className="w-full rounded border border-zinc-300 p-1.5 text-xs focus:border-brand focus:outline-none"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        onClick={() => setReportGapQuery(null)}
                        className="rounded px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleFeedback(msg, -1, true, gapComment)}
                        className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800"
                      >
                        Submit Gap Report
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-zinc-500 bg-white border border-zinc-200 w-fit px-3 py-2 rounded-xl rounded-tl-xs">
              <div className="flex space-x-1">
                <div className="h-1.5 w-1.5 bg-brand rounded-full animate-bounce" />
                <div className="h-1.5 w-1.5 bg-brand rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="h-1.5 w-1.5 bg-brand rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
              <span>Searching vector embeddings and grounding answer...</span>
            </div>
          )}
        </div>

        {/* Suggested Prompt Chips */}
        {messages.length <= 2 && (
          <div className="px-6 py-2 border-t border-zinc-100 bg-white">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Quick Suggestions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {samplePrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(p)}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600 hover:border-brand hover:bg-brand/10 hover:text-zinc-900 transition-all text-left"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Input Bar */}
        <div className="border-t border-zinc-200 bg-white p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about project documents or specs..."
              disabled={loading}
              className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400 px-1">
            <span>Press <kbd className="rounded border bg-zinc-100 px-1 font-mono text-[10px]">Enter</kbd> to ask</span>
            <span>Shortcut: <kbd className="rounded border bg-zinc-100 px-1 font-mono text-[10px]">Ctrl + /</kbd> anywhere</span>
          </div>
        </div>
      </div>

      {/* Grounded Citation Preview Modal */}
      {selectedCitation && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-zinc-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-900 px-6 py-4 text-white">
              <div className="flex items-center gap-2">
                <span className="rounded bg-brand px-2 py-0.5 text-xs font-bold uppercase text-zinc-900">
                  {selectedCitation.sourceType}
                </span>
                <h3 className="font-bold text-white text-sm">{selectedCitation.title}</h3>
              </div>
              <button
                onClick={() => setSelectedCitation(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2 text-xs border-b border-zinc-100 pb-3">
                <div>
                  <span className="text-zinc-400 block">Version</span>
                  <span className="font-semibold text-zinc-700 font-mono">{selectedCitation.version}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Document ID</span>
                  <span className="font-mono text-zinc-700 truncate block">{selectedCitation.documentId}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Similarity Score</span>
                  <span className="font-semibold text-emerald-600">
                    {Math.round(selectedCitation.similarity * 100)}% match
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Extracted Grounding Chunk
                </label>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs text-zinc-800 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                  {selectedCitation.snippet}
                </div>
              </div>

              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                <div className="flex items-center gap-1.5 font-semibold mb-0.5">
                  <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Grounded Citation Verification
                </div>
                This text chunk was retrieved directly from the vector index and presented to the LLM to ground the answer without hallucination.
              </div>
            </div>

            <div className="flex justify-end border-t border-zinc-100 bg-zinc-50 px-6 py-3">
              <button
                onClick={() => setSelectedCitation(null)}
                className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
