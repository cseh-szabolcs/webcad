interface CommandLineProps {
    prompt: string;
    /** Last message, shown above the prompt like AutoCAD's command history. */
    message: string | null;
}

/** AutoCAD-like command line; display only for now, it takes no input. */
export function CommandLine({ prompt, message }: CommandLineProps) {
    return (
        <div className="commandline" aria-live="polite">
            <div className="commandline-history">{message ?? ' '}</div>
            <div className="commandline-prompt">{prompt}</div>
        </div>
    );
}
