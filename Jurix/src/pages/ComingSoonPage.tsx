import { Wrench } from "@phosphor-icons/react";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";

export function ComingSoonPage({ module }: { module: string }) {
  return (
    <>
      <PageHeader
        eyebrow="Módulo"
        title={module}
        description="Este módulo será implementado nas próximas iterações conforme as specs aprovadas no OpenSpec."
      />
      <div className="bezel-shell">
        <div className="bezel-inner">
          <EmptyState
            icon={<Wrench weight="light" />}
            title="Em construção"
            description="A spec deste módulo já está pronta. Aprove-a e implementaremos a próxima."
          />
        </div>
      </div>
    </>
  );
}
