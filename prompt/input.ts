import { GenericPrompt } from "./_generic_prompt.ts";
import {
  GenericSuggestions,
  GenericSuggestionsKeys,
  GenericSuggestionsOptions,
  GenericSuggestionsSettings,
} from "./_generic_suggestions.ts";
import { normalize } from "./deps.ts";

/** Input prompt options. */
export interface InputOptions
  extends GenericSuggestionsOptions<string, string> {
  minLength?: number;
  maxLength?: number;
  keys?: InputKeys;
}

/** Input prompt settings. */
interface InputSettings extends GenericSuggestionsSettings<string, string> {
  minLength: number;
  maxLength: number;
  keys?: InputKeys;
}

export type InputKeys = GenericSuggestionsKeys;

/** Input prompt representation. */
export class Input extends GenericSuggestions<string, string> {
  protected readonly settings: InputSettings;

  /** Execute the prompt and show cursor on end. */
  public static prompt(options: string | InputOptions): Promise<string> {
    return new this(options).prompt();
  }

  /**
   * Inject prompt value. Can be used for unit tests or pre selections.
   * @param value Input value.
   */
  public static inject(value: string): void {
    GenericPrompt.inject(value);
  }

  constructor(options: string | InputOptions) {
    super();
    if (typeof options === "string") {
      options = { message: options };
    }
    this.settings = this.getDefaultSettings(options);
  }

  protected getDefaultSettings(options: InputOptions): InputSettings {
    return {
      ...super.getDefaultSettings(options),
      minLength: options.minLength ?? 0,
      maxLength: options.maxLength ?? Infinity,
    };
  }

  protected success(value: string): string | undefined {
    this.saveSuggestions(value);
    return super.success(value);
  }

  /** Get input value. */
  protected getValue(): string {
    return this.settings.files ? normalize(this.inputValue) : this.inputValue;
  }

  /**
   * Validate input value.
   * @param value User input value.
   * @return True on success, false or error message on error.
   */
  protected validate(value: string): boolean | string {
    if (typeof value !== "string") {
      return false;
    }
    if (value.length < this.settings.minLength) {
      return `Value must be longer than ${this.settings.minLength} but has a length of ${value.length}.`;
    }
    if (value.length > this.settings.maxLength) {
      return `Value can't be longer than ${this.settings.maxLength} but has a length of ${value.length}.`;
    }
    return true;
  }

  /**
   * Map input value to output value.
   * @param value Input value.
   * @return Output value.
   */
  protected transform(value: string): string | undefined {
    return value.trim();
  }

  /**
   * Format output value.
   * @param value Output value.
   */
  protected format(value: string): string {
    return value;
  }
}
