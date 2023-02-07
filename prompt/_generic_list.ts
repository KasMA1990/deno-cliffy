import type { KeyCode } from "../keycode/key_code.ts";
import {
  GenericInput,
  GenericInputKeys,
  GenericInputPromptOptions,
  GenericInputPromptSettings,
} from "./_generic_input.ts";
import { bold, brightBlue, dim, stripColor, yellow } from "./deps.ts";
import { Figures, getFiguresByKeys } from "./figures.ts";
import { distance } from "../_utils/distance.ts";

type UnsupportedInputOptions = "suggestions" | "list";

/** Generic list prompt options. */
export interface GenericListOptions<TValue, TRawValue> extends
  Omit<
    GenericInputPromptOptions<TValue, TRawValue>,
    UnsupportedInputOptions
  > {
  options: Array<
    string | GenericListOption | GenericListOptionGroup<GenericListOption>
  >;
  keys?: GenericListKeys;
  indent?: string;
  listPointer?: string;
  searchIcon?: string;
  maxRows?: number;
  searchLabel?: string;
  search?: boolean;
  info?: boolean;
  maxBreadcrumbItems?: number;
  breadcrumbSeparator?: string;
  backPointer?: string;
  groupPointer?: string;
  groupIcon?: string | boolean;
  groupOpenIcon?: string | boolean;
}

/** Generic list prompt settings. */
export interface GenericListSettings<
  TValue,
  TRawValue,
  TOption extends GenericListOptionSettings,
  TGroup extends GenericListOptionGroupSettings<TOption>,
> extends GenericInputPromptSettings<TValue, TRawValue> {
  options: Array<TOption | TGroup>;
  keys?: GenericListKeys;
  indent: string;
  listPointer: string;
  maxRows: number;
  searchLabel: string;
  search?: boolean;
  info?: boolean;
  maxBreadcrumbItems: number;
  breadcrumbSeparator: string;
  backPointer: string;
  groupPointer: string;
  groupIcon: string | false;
  groupOpenIcon: string | false;
}

/** Generic list option options. */
export interface GenericListOption {
  value: string;
  name?: string;
  disabled?: boolean;
}

/** Generic list option group options. */
export interface GenericListOptionGroup<TOption extends GenericListOption> {
  name: string;
  options: Array<string | TOption | this>;
  disabled?: boolean;
}

/** Generic list option settings. */
export interface GenericListOptionSettings extends GenericListOption {
  name: string;
  value: string;
  disabled: boolean;
  indentLevel: number;
}

/** Generic list option group settings. */
export interface GenericListOptionGroupSettings<
  TOption extends GenericListOptionSettings,
> extends GenericListOptionGroup<TOption> {
  disabled: boolean;
  indentLevel: number;
  options: Array<TOption | this>;
}

/** GenericList key options. */
export interface GenericListKeys extends GenericInputKeys {
  previous?: string[];
  next?: string[];
  previousPage?: string[];
  nextPage?: string[];
}

interface MatchedOption<
  TOption extends GenericListOptionSettings,
  TGroup extends GenericListOptionGroupSettings<TOption>,
> {
  option: TOption | TGroup;
  distance: number;
  children: Array<MatchedOption<TOption, TGroup>>;
}

/** Generic list prompt representation. */
export abstract class GenericList<
  TValue,
  TRawValue,
  TOption extends GenericListOptionSettings,
  TGroup extends GenericListOptionGroupSettings<TOption>,
> extends GenericInput<TValue, TRawValue> {
  protected abstract readonly settings: GenericListSettings<
    TValue,
    TRawValue,
    TOption,
    TGroup
  >;
  protected abstract options: Array<TOption | TGroup>;
  protected abstract listIndex: number;
  protected abstract listOffset: number;
  protected parentOptions: Array<TGroup> = [];

  /**
   * Create list separator.
   * @param label Separator label.
   */
  public static separator(label = "------------"): GenericListOption {
    return { value: label, disabled: true };
  }

  protected getDefaultSettings(
    {
      groupIcon = true,
      groupOpenIcon = groupIcon,
      ...options
    }: GenericListOptions<TValue, TRawValue>,
  ): GenericListSettings<TValue, TRawValue, TOption, TGroup> {
    const settings = super.getDefaultSettings(options);
    return {
      listPointer: brightBlue(Figures.POINTER),
      searchLabel: brightBlue(Figures.SEARCH),
      backPointer: brightBlue(Figures.LEFT_POINTER),
      maxBreadcrumbItems: 5,
      breadcrumbSeparator: "›",
      ...settings,
      groupPointer: options.groupPointer || options.listPointer ||
        brightBlue(Figures.POINTER),
      groupIcon: !groupIcon
        ? false
        : typeof groupIcon === "string"
        ? groupIcon
        : Figures.FOLDER,
      groupOpenIcon: !groupOpenIcon
        ? false
        : typeof groupOpenIcon === "string"
        ? groupOpenIcon
        : Figures.FOLDER_OPEN,
      maxRows: options.maxRows ?? 10,
      options: this.mapOptions(options, options.options),
      keys: {
        previous: options.search ? ["up"] : ["up", "u", "p", "8"],
        next: options.search ? ["down"] : ["down", "d", "n", "2"],
        previousPage: ["pageup", "left"],
        nextPage: ["pagedown", "right"],
        ...(settings.keys ?? {}),
      },
    };
  }

  protected abstract mapOptions(
    promptOptions: GenericListOptions<TValue, TRawValue>,
    options: Array<
      string | GenericListOption | GenericListOptionGroup<GenericListOption>
    >,
  ): Array<TOption | TGroup>;

  protected mapOption(
    _options: GenericListOptions<TValue, TRawValue>,
    option: GenericListOption,
  ): GenericListOptionSettings {
    return {
      value: option.value,
      name: typeof option.name === "undefined" ? option.value : option.name,
      disabled: !!option.disabled,
      indentLevel: 0,
    };
  }

  protected mapOptionGroup(
    options: GenericListOptions<TValue, TRawValue>,
    option: GenericListOptionGroup<GenericListOption>,
    recursive = true,
  ): GenericListOptionGroupSettings<GenericListOptionSettings> {
    return {
      name: option.name,
      disabled: !!option.disabled,
      indentLevel: 0,
      options: recursive ? this.mapOptions(options, option.options) : [],
    };
  }

  protected flatOptions(
    options: Array<TOption | TGroup>,
    groups: false,
  ): Array<TOption>;

  protected flatOptions(
    options: Array<TOption | TGroup>,
    groups?: boolean,
  ): Array<TOption | TGroup>;

  protected flatOptions(
    options: Array<TOption | TGroup>,
    groups = true,
  ): Array<TOption | TGroup> {
    return flat(options, groups);

    function flat(
      options: Array<TOption | TGroup>,
      groups = true,
      indentLevel = 0,
      opts: Array<TOption | TGroup> = [],
    ): Array<TOption | TGroup> {
      for (const option of options) {
        option.indentLevel = indentLevel;
        if (isOption(option) || groups) {
          opts.push(option);
        }
        if (isOptionGroup(option)) {
          flat(option.options, groups, ++indentLevel, opts);
        }
      }

      return opts;
    }
  }

  protected match(): void {
    const input: string = this.getCurrentInputValue().toLowerCase();
    let options: Array<TOption | TGroup> = this.getCurrentOptions().slice();

    if (input.length) {
      const matches = this.matchOptions(input, this.getCurrentOptions());
      options = this.flatMatchedOptions(matches);
    }

    this.setOptions(options);
  }

  protected setOptions(options: Array<TOption | TGroup>) {
    this.options = [...options];

    const parent = this.getParentOption();
    if (parent && this.options[0] !== parent) {
      this.options.unshift(parent);
    }

    this.listIndex = Math.max(
      0,
      Math.min(this.options.length - 1, this.listIndex),
    );
    this.listOffset = Math.max(
      0,
      Math.min(
        this.options.length - this.getListHeight(),
        this.listOffset,
      ),
    );
  }

  protected getCurrentOptions(): Array<TOption | TGroup> {
    return this.getParentOption()?.options ?? this.settings.options;
  }

  protected getParentOption(index = -1): TGroup | undefined {
    return this.parentOptions.at(index);
  }

  private matchOptions(
    searchInput: string,
    options: Array<TOption | TGroup>,
  ): Array<MatchedOption<TOption, TGroup>> {
    const matched: Array<MatchedOption<TOption, TGroup>> = [];

    for (const option of options) {
      if (isOptionGroup(option)) {
        const children = this
          .matchOptions(searchInput, option.options)
          .sort(sortByDistance);

        if (children.length) {
          matched.push({
            option,
            distance: Math.min(...children.map((item) => item.distance)),
            children,
          });
          continue;
        }
      }

      if (this.matchOption(searchInput, option)) {
        matched.push({
          option,
          distance: distance(option.name, searchInput),
          children: [],
        });
      }
    }

    return matched.sort(sortByDistance);

    function sortByDistance(
      a: MatchedOption<TOption, TGroup>,
      b: MatchedOption<TOption, TGroup>,
    ): number {
      return a.distance - b.distance;
    }
  }

  private flatMatchedOptions(
    matches: Array<MatchedOption<TOption, TGroup>>,
    indentLevel = 0,
    result: Array<TOption | TGroup> = [],
  ): Array<TOption | TGroup> {
    for (const { option, children } of matches) {
      option.indentLevel = indentLevel;
      result.push(option);
      this.flatMatchedOptions(children, indentLevel + 1, result);
    }

    return result;
  }

  private matchOption(
    inputString: string,
    option: TOption | TGroup,
  ): boolean {
    return this.matchInput(inputString, option.name) || (
      isOption(option) &&
      option.name !== option.value &&
      this.matchInput(inputString, option.value)
    );
  }

  private matchInput(inputString: string, value: string): boolean {
    return stripColor(value)
      .toLowerCase()
      .includes(inputString);
  }

  protected async submit(): Promise<void> {
    const selectedOption = this.options[this.listIndex];

    if (this.isBackButton(selectedOption)) {
      this.submitBackButton();
    } else if (isOptionGroup(selectedOption)) {
      this.submitGroupOption(selectedOption);
    } else {
      await super.submit();
    }
  }

  protected submitBackButton() {
    const parentOption = this.parentOptions.pop();
    if (!parentOption) {
      return;
    }
    const options = this.getCurrentOptions();
    this.setOptions(options);
    this.listIndex = this.options.indexOf(parentOption);
  }

  protected submitGroupOption(selectedOption: TGroup) {
    this.parentOptions.push(selectedOption);
    this.setOptions(selectedOption.options);
    this.listIndex = 1;
  }

  protected isBackButton(option: TOption | TGroup): boolean {
    return option === this.getParentOption();
  }

  protected hasParent(): boolean {
    return this.parentOptions.length > 0;
  }

  protected isSearching(): boolean {
    return this.getCurrentInputValue() !== "";
  }

  protected message(): string {
    let message = `${this.settings.indent}${this.settings.prefix}` +
      bold(this.settings.message) +
      this.defaults();
    if (this.settings.search) {
      message += " " + this.settings.searchLabel + " ";
    }
    this.cursor.x = stripColor(message).length + this.inputIndex + 1;
    return message + this.input();
  }

  /** Render options. */
  protected body(): string | Promise<string> {
    return this.getList() + this.getInfo();
  }

  protected getInfo(): string {
    if (!this.settings.info) {
      return "";
    }
    const selected: number = this.listIndex + 1;
    const actions: Array<[string, Array<string>]> = [
      ["Next", getFiguresByKeys(this.settings.keys?.next ?? [])],
      ["Previous", getFiguresByKeys(this.settings.keys?.previous ?? [])],
      ["Next Page", getFiguresByKeys(this.settings.keys?.nextPage ?? [])],
      [
        "Previous Page",
        getFiguresByKeys(this.settings.keys?.previousPage ?? []),
      ],
      ["Submit", getFiguresByKeys(this.settings.keys?.submit ?? [])],
    ];

    return "\n" + this.settings.indent + brightBlue(Figures.INFO) +
      bold(` ${selected}/${this.options.length} `) +
      actions
        .map((cur) => `${cur[0]}: ${bold(cur[1].join(", "))}`)
        .join(", ");
  }

  /** Render options list. */
  protected getList(): string {
    const list: Array<string> = [];
    const height: number = this.getListHeight();
    for (let i = this.listOffset; i < this.listOffset + height; i++) {
      list.push(
        this.getListItem(
          this.options[i],
          this.listIndex === i,
        ),
      );
    }
    if (!list.length) {
      list.push(
        this.settings.indent + dim("  No matches..."),
      );
    }
    return list.join("\n");
  }

  /**
   * Render option.
   * @param option        Option.
   * @param isSelected  Set to true if option is selected.
   */
  protected getListItem(
    option: TOption | TGroup,
    isSelected?: boolean,
  ): string {
    let line = this.getListItemIndent(option);
    line += this.getListItemPointer(option, isSelected);
    line += this.getListItemIcon(option);
    line += this.getListItemLabel(option, isSelected);

    return line;
  }

  protected getListItemIndent(option: TOption | TGroup) {
    const indentLevel = this.isSearching()
      ? option.indentLevel
      : this.hasParent() && !this.isBackButton(option)
      ? 1
      : 0;

    return this.settings.indent + " ".repeat(indentLevel);
  }

  protected getListItemPointer(option: TOption | TGroup, isSelected?: boolean) {
    if (!isSelected) {
      return "  ";
    }

    if (this.isBackButton(option)) {
      return this.settings.backPointer + " ";
    } else if (isOptionGroup(option)) {
      return this.settings.groupPointer + " ";
    }

    return this.settings.listPointer + " ";
  }

  protected getListItemIcon(option: TOption | TGroup): string {
    if (this.isBackButton(option)) {
      return this.settings.groupOpenIcon
        ? this.settings.groupOpenIcon + " "
        : "";
    } else if (isOptionGroup(option)) {
      return this.settings.groupIcon ? this.settings.groupIcon + " " : "";
    }

    return "";
  }

  protected getListItemLabel(
    option: TOption | TGroup,
    isSelected?: boolean,
  ): string {
    let label: string = option.name;

    if (this.isBackButton(option)) {
      label = this.getBreadCrumb();
      label = isSelected && !option.disabled ? yellow(label) : dim(label);
    } else {
      label = isSelected && !option.disabled
        ? this.highlight(label, (val) => val)
        : this.highlight(label);
    }

    if (this.isBackButton(option) || isOptionGroup(option)) {
      label = bold(label);
    }

    return label;
  }

  protected getBreadCrumb() {
    if (!this.parentOptions.length || !this.settings.maxBreadcrumbItems) {
      return "";
    }
    const names = this.parentOptions.map((option) => option.name);
    const breadCrumb = names.length > this.settings.maxBreadcrumbItems
      ? [names[0], "..", ...names.slice(-this.settings.maxBreadcrumbItems + 1)]
      : names;

    return breadCrumb.join(` ${this.settings.breadcrumbSeparator} `);
  }

  /** Get options row height. */
  protected getListHeight(): number {
    return Math.min(
      this.options.length,
      this.settings.maxRows || this.options.length,
    );
  }

  protected getListIndex(value?: string) {
    return Math.max(
      0,
      typeof value === "undefined"
        ? this.options.findIndex((option: TOption | TGroup) =>
          !option.disabled
        ) || 0
        : this.options.findIndex((option: TOption | TGroup) =>
          isOption(option) && option.value === value
        ) ||
          0,
    );
  }

  protected getPageOffset(index: number) {
    if (index === 0) {
      return 0;
    }
    const height: number = this.getListHeight();
    return Math.floor(index / height) * height;
  }

  /**
   * Find option by value.
   * @param value Value of the option.
   */
  protected getOptionByValue(
    value: string,
  ): TOption | undefined {
    const option = this.options.find((option) =>
      isOption(option) && option.value === value
    );

    return option && isOptionGroup(option) ? undefined : option;
  }

  /** Read user input. */
  protected read(): Promise<boolean> {
    if (!this.settings.search) {
      this.tty.cursorHide();
    }
    return super.read();
  }

  /**
   * Handle user input event.
   * @param event Key event.
   */
  protected async handleEvent(event: KeyCode): Promise<void> {
    switch (true) {
      case this.isKey(this.settings.keys, "previous", event):
        this.selectPrevious();
        break;
      case this.isKey(this.settings.keys, "next", event):
        this.selectNext();
        break;
      case this.isKey(this.settings.keys, "nextPage", event):
        this.selectNextPage();
        break;
      case this.isKey(this.settings.keys, "previousPage", event):
        this.selectPreviousPage();
        break;
      default:
        await super.handleEvent(event);
    }
  }

  protected moveCursorLeft(): void {
    if (this.settings.search) {
      super.moveCursorLeft();
    }
  }

  protected moveCursorRight(): void {
    if (this.settings.search) {
      super.moveCursorRight();
    }
  }

  protected deleteChar(): void {
    if (this.settings.search) {
      super.deleteChar();
    }
  }

  protected deleteCharRight(): void {
    if (this.settings.search) {
      super.deleteCharRight();
      this.match();
    }
  }

  protected addChar(char: string): void {
    if (this.settings.search) {
      super.addChar(char);
      this.match();
    }
  }

  /** Select previous option. */
  protected selectPrevious(): void {
    if (this.options.length < 2) {
      return;
    }
    if (this.listIndex > 0) {
      this.listIndex--;
      if (this.listIndex < this.listOffset) {
        this.listOffset--;
      }
      if (this.options[this.listIndex].disabled) {
        this.selectPrevious();
      }
    } else {
      this.listIndex = this.options.length - 1;
      this.listOffset = this.options.length - this.getListHeight();
      if (this.options[this.listIndex].disabled) {
        this.selectPrevious();
      }
    }
  }

  /** Select next option. */
  protected selectNext(): void {
    if (this.options.length < 2) {
      return;
    }
    if (this.listIndex < this.options.length - 1) {
      this.listIndex++;
      if (this.listIndex >= this.listOffset + this.getListHeight()) {
        this.listOffset++;
      }
      if (this.options[this.listIndex].disabled) {
        this.selectNext();
      }
    } else {
      this.listIndex = this.listOffset = 0;
      if (this.options[this.listIndex].disabled) {
        this.selectNext();
      }
    }
  }

  /** Select previous page. */
  protected selectPreviousPage(): void {
    if (this.options?.length) {
      const height: number = this.getListHeight();
      if (this.listOffset >= height) {
        this.listIndex -= height;
        this.listOffset -= height;
      } else if (this.listOffset > 0) {
        this.listIndex -= this.listOffset;
        this.listOffset = 0;
      }
    }
  }

  /** Select next page. */
  protected selectNextPage(): void {
    if (this.options?.length) {
      const height: number = this.getListHeight();
      if (this.listOffset + height + height < this.options.length) {
        this.listIndex += height;
        this.listOffset += height;
      } else if (this.listOffset + height < this.options.length) {
        const offset = this.options.length - height;
        this.listIndex += offset - this.listOffset;
        this.listOffset = offset;
      }
    }
  }
}

export function isOption<
  TOption extends GenericListOption,
>(
  option: TOption | GenericListOptionGroup<GenericListOption>,
): option is TOption {
  return "value" in option;
}

export function isOptionGroup<
  TGroup extends GenericListOptionGroup<GenericListOption>,
>(
  option: TGroup | GenericListOption | string,
): option is TGroup {
  return typeof option === "object" && "options" in option &&
    option.options.length > 0;
}

export function assertIsOption<
  TOption extends GenericListOption,
>(
  option: TOption | GenericListOptionGroup<GenericListOption>,
): asserts option is TOption {
  if (!isOption(option)) {
    throw new Error("Expected an option but got an option group.");
  }
}

/** @deprecated Use `Array<string | GenericListOption>` instead. */
export type GenericListValueOptions = Array<string | GenericListOption>;
/** @deprecated Use `Array<GenericListOptionSettings>` instead. */
export type GenericListValueSettings = Array<GenericListOptionSettings>;
