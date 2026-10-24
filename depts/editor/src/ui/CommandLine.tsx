interface CommandLineProps {
    prompt: string;
    /** Text typed at the prompt so far. */
    input: string;
    /** The prompt takes typed input, so a caret shows after it. */
    acceptsInput: boolean;
    /** Last message, shown above the prompt like AutoCAD's command history. */
    message: string | null;
}

/** AutoCAD-like command line; display only, the editor receives the typed keys. */
export function CommandLine({ prompt, input, acceptsInput, message }: CommandLineProps) {
    return (
        <div className="commandline" aria-live="polite">
            <div className="commandline-history">{message ?? ' '}</div>
            <div className="commandline-prompt">
                {prompt} {input}
                {acceptsInput && <span className="commandline-caret" aria-hidden="true" />}
            </div>
        </div>
    );
}
