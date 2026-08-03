import { useCallback, useEffect, useRef, useState } from "react";

import { WorkspaceDialog } from "./WorkspaceDialog";

type TextPromptOptions = {
  title: string;
  description?: string;
  label?: string;
  initialValue?: string;
  placeholder?: string;
  inputType?: "text" | "password";
  autoComplete?: string;
  confirmLabel?: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  required?: boolean;
  maxLength?: number;
};

type ConfirmPromptOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

type PromptRequest =
  | ({ kind: "text" } & TextPromptOptions)
  | ({ kind: "confirm" } & ConfirmPromptOptions);

type PromptResult = string | boolean | null;

const WorkspacePromptDialog = ({
  request,
  onResolve,
}: {
  request: PromptRequest;
  onResolve: (value: PromptResult) => void;
}) => {
  const [value, setValue] = useState(
    request.kind === "text" ? request.initialValue ?? "" : "",
  );

  return (
    <WorkspaceDialog
      title={request.title}
      description={request.description}
      onClose={() => onResolve(request.kind === "confirm" ? false : null)}
    >
      <form
        className="workspace-form workspace-prompt-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (request.kind === "confirm") {
            onResolve(true);
            return;
          }
          if (request.required !== false && !value.trim()) {
            return;
          }
          onResolve(value);
        }}
      >
        {request.kind === "text" && (
          <label>
            {request.label ?? "Nombre"}
            <input
              type={request.inputType ?? "text"}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={request.placeholder}
              autoComplete={request.autoComplete}
              required={request.required !== false}
              maxLength={request.maxLength ?? 160}
              autoFocus
            />
          </label>
        )}
        <div className="workspace-dialog__actions">
          <button
            type="button"
            className="workspace-button"
            onClick={() => onResolve(request.kind === "confirm" ? false : null)}
          >
            Cancelar
          </button>
          {request.kind === "text" && request.secondaryLabel && (
            <button
              type="button"
              className="workspace-button"
              onClick={() => onResolve(request.secondaryValue ?? "")}
            >
              {request.secondaryLabel}
            </button>
          )}
          <button
            type="submit"
            className={`workspace-button workspace-button--primary${
              request.kind === "confirm" && request.destructive
                ? " workspace-button--danger"
                : ""
            }`}
            disabled={
              request.kind === "text" &&
              request.required !== false &&
              !value.trim()
            }
          >
            {request.confirmLabel ??
              (request.kind === "confirm" ? "Confirmar" : "Guardar")}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
};

export const useWorkspacePrompts = () => {
  const [request, setRequest] = useState<PromptRequest | null>(null);
  const resolverRef = useRef<((value: PromptResult) => void) | null>(null);

  const resolve = useCallback((value: PromptResult) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  useEffect(
    () => () => {
      resolverRef.current?.(null);
      resolverRef.current = null;
    },
    [],
  );

  const open = useCallback((nextRequest: PromptRequest) => {
    resolverRef.current?.(null);
    return new Promise<PromptResult>((resolvePrompt) => {
      resolverRef.current = resolvePrompt;
      setRequest(nextRequest);
    });
  }, []);

  const askText = useCallback(
    async (options: TextPromptOptions) => {
      const result = await open({ kind: "text", ...options });
      return typeof result === "string" ? result : null;
    },
    [open],
  );

  const askConfirm = useCallback(
    async (options: ConfirmPromptOptions) =>
      (await open({ kind: "confirm", ...options })) === true,
    [open],
  );

  return {
    askText,
    askConfirm,
    promptDialog: request ? (
      <WorkspacePromptDialog request={request} onResolve={resolve} />
    ) : null,
  };
};
