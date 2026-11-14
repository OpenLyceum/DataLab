import type { NamedRun, RunSession, Session } from "./sessionFile.js";

/** Holds inactive run snapshots. The active run lives in the model and graph view. */
export class RunWorkspace {
  private runs: NamedRun[];
  private activeIndex = 0;
  private readonly capture: () => Session;
  private readonly restore: (session: Session) => void;

  public constructor(firstName: string, capture: () => Session, restore: (session: Session) => void) {
    this.capture = capture;
    this.restore = restore;
    this.runs = [{ name: firstName, session: capture() }];
  }

  public get names(): readonly string[] {
    return this.runs.map((run) => run.name);
  }

  public get selectedIndex(): number {
    return this.activeIndex;
  }

  public select(index: number): void {
    const run = this.runs[index];
    if (!run || index === this.activeIndex) {
      return;
    }
    this.snapshot();
    this.activeIndex = index;
    this.restore(run.session);
  }

  public add(name: string, session: Session): void {
    this.snapshot();
    this.activeIndex = this.runs.length;
    this.runs.push({ name, session });
    this.restore(session);
  }

  public rename(name: string): void {
    this.runs[this.activeIndex] = { name, session: this.capture() };
  }

  public remove(): void {
    if (this.runs.length <= 1) {
      return;
    }
    this.runs.splice(this.activeIndex, 1);
    this.activeIndex = Math.min(this.activeIndex, this.runs.length - 1);
    this.restore((this.runs[this.activeIndex] as NamedRun).session);
  }

  public save(): RunSession {
    this.snapshot();
    return { runs: [...this.runs], activeIndex: this.activeIndex };
  }

  public load(session: RunSession): void {
    this.runs = [...session.runs];
    this.activeIndex = session.activeIndex;
    this.restore((this.runs[this.activeIndex] as NamedRun).session);
  }

  private snapshot(): void {
    const current = this.runs[this.activeIndex] as NamedRun;
    this.runs[this.activeIndex] = { ...current, session: this.capture() };
  }
}
