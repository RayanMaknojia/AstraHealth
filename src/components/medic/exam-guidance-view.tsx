import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { listProcedures } from "@/services/guidanceService";
import { Button } from "@/components/ui/button";
import { EXAM_GUIDES, type ExamGuideId } from "./exam-guidance";
export function ExamGuidance({
  focusGuide,
  onCheckin,
}: {
  focusGuide?: ExamGuideId | null;
  onCheckin: () => void;
}) {
  useEffect(() => {
    if (!focusGuide) return;
    const node = document.getElementById(`exam-guide-${focusGuide}`);
    node?.scrollIntoView({ block: "start", behavior: "instant" });
    node?.querySelector("summary")?.focus({ preventScroll: true });
  }, [focusGuide]);
  const procedures = listProcedures();
  return (
    <div className="exam-guidance-list">
      {EXAM_GUIDES.map((guide) => {
        const procedure =
          "procedureId" in guide
            ? procedures.find((p) => p.id === guide.procedureId)
            : null;
        return (
          <details
            id={`exam-guide-${guide.id}`}
            className="procedure exam-guide"
            key={guide.id}
            open={focusGuide === guide.id ? true : undefined}
          >
            <summary>{guide.title}</summary>
            <ol>
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {procedure && (
              <section>
                <h3>{procedure.title}</h3>
                <ol>
                  {procedure.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {procedure.tips.map((t) => (
                  <p key={t}>{t}</p>
                ))}
              </section>
            )}
            <Button variant="outline" onClick={onCheckin}>
              <ArrowLeft data-icon="inline-start" />
              Back to Check-in
            </Button>
          </details>
        );
      })}
    </div>
  );
}
