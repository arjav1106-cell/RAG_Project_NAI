import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUp,
  BookOpenCheck,
  Check,
  ChevronDown,
  FileSearch,
  RotateCcw,
  Scale,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  EmptyState,
  LoadingState,
  Notice,
  PageHeading,
} from "../components/ui";
import { api, ApiError, documentUrl } from "../lib/api";
import { formatDate } from "../lib/format";
import type { AssistantResponse, Policy, Vehicle } from "../lib/types";

type ChatMessage = {
  question: string;
  response?: AssistantResponse;
  error?: string;
};
const suggestions = [
  {
    icon: ShieldAlert,
    title: "Understand an accident",
    prompt:
      "A vehicle hit the rear of my car and damaged the bumper. Which parts of my cover appear relevant, and what facts would the insurer need?",
  },
  {
    icon: Scale,
    title: "Check a modification",
    prompt:
      "I’m planning to add aftermarket alloy wheels. What conditions in my policy may apply, and what should I confirm with my insurer?",
  },
  {
    icon: BookOpenCheck,
    title: "Prepare a claim checklist",
    prompt:
      "Create a checklist of the claim steps and documents mentioned in my policy.",
  },
  {
    icon: FileSearch,
    title: "Explain my exclusions",
    prompt:
      "Summarize the main exclusions and conditions in this policy in plain language.",
  },
];

export function AssistantPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [scope, setScope] = useState("all");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([api.vehicles(), api.policies()])
      .then(([garage, policyList]) => {
        setVehicles(garage);
        setPolicies(policyList);
      })
      .catch((cause) =>
        setError(cause.message || "Your garage could not be loaded."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const scopeOptions = [
    { value: "all", label: "All my policies" },
    ...vehicles.map((vehicle) => ({
      value: `vehicle:${vehicle.id}`,
      label: `${vehicle.label} · all policies`,
    })),
    ...policies.map((policy) => {
      const vehicle = vehicles.find((item) => item.id === policy.vehicle_id);
      return {
        value: `policy:${policy.id}`,
        label: `${vehicle?.label ?? "Vehicle"} · ${policy.insurer || "Policy"}`,
      };
    }),
  ];

  const ask = async (event?: FormEvent, preset?: string) => {
    event?.preventDefault();
    const text = (preset ?? question).trim();
    if (text.length < 3 || busy) return;
    let vehicleId: number | undefined;
    let policyId: number | undefined;
    if (scope.startsWith("vehicle:")) vehicleId = Number(scope.split(":")[1]);
    if (scope.startsWith("policy:")) policyId = Number(scope.split(":")[1]);
    setQuestion("");
    setBusy(true);
    setError("");
    setMessages((current) => [...current, { question: text }]);
    try {
      const response = await api.ask(text, vehicleId, policyId);
      setMessages((current) =>
        current.map((message, index) =>
          index === current.length - 1 ? { ...message, response } : message,
        ),
      );
    } catch (cause) {
      const message =
        cause instanceof ApiError
          ? cause.message
          : "The assistant could not answer. Check that the API and local model are available.";
      setMessages((current) =>
        current.map((item, index) =>
          index === current.length - 1 ? { ...item, error: message } : item,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!vehicles.length)
    return (
      <div className="page-stack">
        <PageHeading
          eyebrow="GROUNDED ANSWERS"
          title="Policy assistant"
          description="Ask questions using your uploaded policies and official guidance."
        />
        <section className="surface-card large-empty">
          <EmptyState
            title="Add a vehicle to get started"
            text="Once your garage has a vehicle and policy, you can ask questions about its cover."
          />
        </section>
      </div>
    );

  return (
    <div className="page-stack assistant-page">
      <PageHeading
        eyebrow="GROUNDED ANSWERS"
        title="Policy assistant"
        description="Ask in plain language. Get explanations linked to the policy clauses and official sources behind them."
        actions={
          messages.length > 0 && (
            <button
              className="button button-secondary button-small"
              onClick={() => setMessages([])}
            >
              <RotateCcw size={14} /> New conversation
            </button>
          )
        }
      />
      {error && <Notice tone="error">{error}</Notice>}
      <section className="assistant-layout">
        <div className="assistant-main">
          <div className="assistant-context-bar">
            <div className="assistant-bot-avatar">
              <Sparkles size={17} />
            </div>
            <div className="assistant-context-copy">
              <strong>Vahana policy guide</strong>
              <span>
                Answers use your documents and curated Indian legal sources.
              </span>
            </div>
            <label className="scope-select-label">
              <span>Search in</span>
              <span className="scope-select-wrap">
                <select
                  aria-label="Search in"
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                >
                  {scopeOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </span>
            </label>
          </div>
          <div
            className={`conversation-area ${messages.length ? "conversation-filled" : ""}`}
          >
            {messages.length === 0 ? (
              <div className="assistant-welcome">
                <div className="welcome-orb">
                  <div className="welcome-orb-center">
                    <Sparkles size={23} />
                  </div>
                  <span className="welcome-orb-ring ring-a" />
                  <span className="welcome-orb-ring ring-b" />
                </div>
                <span className="eyebrow">HERE TO MAKE IT CLEAR</span>
                <h2>
                  What would you like
                  <br />
                  to understand?
                </h2>
                <p>
                  Ask about coverage, exclusions, a claim, or a planned change.
                  Answers link back to the source.
                </p>
                <div className="prompt-grid">
                  {suggestions.map(({ icon: Icon, title, prompt }) => (
                    <button
                      key={title}
                      className="prompt-card"
                      onClick={() => void ask(undefined, prompt)}
                    >
                      <span className="prompt-icon">
                        <Icon size={16} />
                      </span>
                      <span>
                        <strong>{title}</strong>
                        <small>{prompt}</small>
                      </span>
                      <ArrowRight size={14} className="prompt-arrow" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="conversation-thread">
                {messages.map((message, index) => (
                  <div
                    className="message-pair"
                    key={`${index}-${message.question}`}
                  >
                    <div className="user-question">
                      <span className="user-bubble">YOU</span>
                      <p>{message.question}</p>
                    </div>
                    {message.error ? (
                      <div className="assistant-error">
                        <div className="assistant-bot-avatar small">
                          <Sparkles size={14} />
                        </div>
                        <div>
                          <strong>The assistant couldn’t answer yet</strong>
                          <p>{message.error}</p>
                          {message.error.includes("Ollama") && (
                            <span>
                              Start Ollama, then pull the configured chat and
                              embedding models.
                            </span>
                          )}
                        </div>
                      </div>
                    ) : message.response ? (
                      <AnswerCard response={message.response} />
                    ) : (
                      <div className="answer-loading">
                        <span className="assistant-bot-avatar small">
                          <Sparkles size={14} />
                        </span>
                        <span className="typing-dots">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span>Checking your sources</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
          <form
            className="question-composer"
            onSubmit={(event) => void ask(event)}
          >
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask a question about your policy…"
              rows={2}
              maxLength={4000}
              aria-label="Ask your policy question"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void ask();
                }
              }}
            />
            <div className="composer-bottom">
              <span>
                <ShieldAlert size={13} /> Informational explanations, not claim
                decisions
              </span>
              <button
                className="send-question"
                type="submit"
                disabled={busy || question.trim().length < 3}
                aria-label="Send question"
              >
                {busy ? (
                  <span className="spinner spinner-light" />
                ) : (
                  <ArrowUp size={17} />
                )}
              </button>
            </div>
          </form>
          <p className="assistant-disclaimer">
            The issued policy and insurer’s assessment govern actual coverage.
            Vahana helps you find and understand relevant terms.
          </p>
        </div>
        <aside className="assistant-side-panel">
          <div className="side-panel-heading">
            <span className="side-panel-icon">
              <BookOpenCheck size={16} />
            </span>
            <div>
              <h3>How answers work</h3>
              <p>Grounded in your sources</p>
            </div>
          </div>
          <div className="answer-principles">
            <div>
              <span className="principle-number">01</span>
              <div>
                <strong>We look it up</strong>
                <p>
                  Relevant clauses are retrieved from your policy and official
                  sources.
                </p>
              </div>
            </div>
            <div>
              <span className="principle-number">02</span>
              <div>
                <strong>We show the source</strong>
                <p>
                  Every answer includes a link or a page and section reference.
                </p>
              </div>
            </div>
            <div>
              <span className="principle-number">03</span>
              <div>
                <strong>We say when we can’t tell</strong>
                <p>
                  If evidence is missing, the assistant asks for more context
                  instead of guessing.
                </p>
              </div>
            </div>
          </div>
          <div className="side-panel-divider" />
          <div className="source-list-heading">
            <span>YOUR SOURCES</span>
            <span className="source-count">{policies.length}</span>
          </div>
          {policies.length === 0 ? (
            <p className="sources-empty">
              Add a policy to give your assistant something personal to search.
            </p>
          ) : (
            <div className="assistant-source-list">
              {policies.slice(0, 4).map((policy) => (
                <button
                  key={policy.id}
                  onClick={() => setScope(`policy:${policy.id}`)}
                  className={`assistant-source-item ${scope === `policy:${policy.id}` ? "selected" : ""}`}
                >
                  <span className="source-doc-icon">
                    <BookOpenCheck size={14} />
                  </span>
                  <span>
                    <strong>{policy.insurer || "Policy document"}</strong>
                    <small>
                      {policy.end_date
                        ? `Expires ${formatDate(policy.end_date)}`
                        : "Policy details"}
                    </small>
                  </span>
                  {scope === `policy:${policy.id}` && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
          <div className="source-library-link">
            <span className="tiny-shield">
              <Check size={11} />
            </span>
            <span>Official legal references included</span>
          </div>
        </aside>
      </section>
    </div>
  );
}

function AnswerCard({ response }: { response: AssistantResponse }) {
  return (
    <div
      className={`answer-card ${response.insufficient_evidence ? "answer-cautious" : ""}`}
    >
      <div className="answer-heading">
        <span className="assistant-bot-avatar small">
          <Sparkles size={14} />
        </span>
        <div>
          <strong>
            {response.insufficient_evidence
              ? "Here’s what I could find"
              : "Policy guide"}
          </strong>
          <span>
            {response.insufficient_evidence
              ? "More information may be needed"
              : "Based on your selected sources"}
          </span>
        </div>
        <span className="answer-verified">
          <Check size={12} /> Sources attached
        </span>
      </div>
      <div className="answer-body">{response.answer}</div>
      {response.citations.length > 0 && (
        <div className="answer-citations">
          <div className="citation-heading">
            <BookOpenCheck size={14} />
            <strong>Sources used</strong>
            <span>{response.citations.length}</span>
          </div>
          {response.citations.map((citation) => (
            <div className="citation-card" key={citation.citation_id}>
              <span className="citation-id">{citation.citation_id}</span>
              <div className="citation-copy">
                <strong>{citation.title}</strong>
                <span>
                  {[citation.publisher, citation.location]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <blockquote>{citation.excerpt}</blockquote>
                {citation.url ? (
                  <a href={citation.url} target="_blank" rel="noreferrer">
                    Open official source <ArrowRight size={12} />
                  </a>
                ) : citation.document_id ? (
                  <a
                    href={documentUrl(citation.document_id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open policy document <ArrowRight size={12} />
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="answer-disclaimer">
        <ShieldAlert size={13} />
        {response.disclaimer}
      </div>
    </div>
  );
}
