import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Check, ChevronDown, Search } from "lucide-solid";

export interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeType?: "neutral" | "emerald" | "amber" | "rose" | "cyan";
  icon?: JSX.Element;
  disabled?: boolean;
}

export interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  searchable?: boolean;
  size?: "sm" | "md" | "lg";
  class?: string;
  buttonClass?: string;
  menuClass?: string;
  emptyText?: string;
  align?: "left" | "right";
}

export const Dropdown: Component<DropdownProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const [highlightedIndex, setHighlightedIndex] = createSignal(0);

  let containerRef: HTMLDivElement | undefined;
  let searchInputRef: HTMLInputElement | undefined;
  let listRef: HTMLUListElement | undefined;

  const size = () => props.size || "md";

  const selectedOption = createMemo(() => {
    return props.options.find((opt) => opt.value === props.value);
  });

  const filteredOptions = createMemo(() => {
    const q = search().trim().toLowerCase();
    if (!q) return props.options;
    return props.options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q)),
    );
  });

  const handleToggle = () => {
    if (props.disabled) return;
    const next = !isOpen();
    setIsOpen(next);
    if (next) {
      setSearch("");
      const idx = filteredOptions().findIndex((opt) => opt.value === props.value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
      setTimeout(() => {
        if (searchInputRef) searchInputRef.focus();
      }, 50);
    }
  };

  const handleSelect = (option: DropdownOption) => {
    if (option.disabled) return;
    props.onChange(option.value);
    setIsOpen(false);
    setSearch("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen()) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        handleToggle();
      }
      return;
    }

    const count = filteredOptions().length;
    if (count === 0) {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % count);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + count) % count);
        break;
      case "Enter":
      case " ":
        if (e.target === searchInputRef && e.key === " ") break;
        e.preventDefault();
        const opt = filteredOptions()[highlightedIndex()];
        if (opt) handleSelect(opt);
        break;
      case "Escape":
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  // Scroll active option into view
  createEffect(() => {
    if (!isOpen()) return;
    const idx = highlightedIndex();
    if (listRef && listRef.children[idx]) {
      const el = listRef.children[idx] as HTMLElement;
      el.scrollIntoView({ block: "nearest" });
    }
  });

  // Handle outside click
  onMount(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef && !containerRef.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    onCleanup(() => {
      window.removeEventListener("pointerdown", onPointerDown);
    });
  });

  const getBadgeClass = (type?: DropdownOption["badgeType"]) => {
    switch (type) {
      case "emerald":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80";
      case "amber":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80";
      case "rose":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80";
      case "cyan":
        return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/80";
      case "neutral":
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  const buttonSizeClass = createMemo(() => {
    switch (size()) {
      case "sm":
        return "px-2.5 py-1 text-xs rounded-lg min-h-[30px]";
      case "lg":
        return "px-3.5 py-2.5 text-sm rounded-xl min-h-[44px]";
      case "md":
      default:
        return "px-3 py-2 text-xs rounded-xl min-h-[38px]";
    }
  });

  return (
    <div
      ref={(el) => (containerRef = el)}
      class={`relative inline-block text-left select-none ${props.class || "w-full"}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={props.disabled}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen()}
        class={`w-full flex items-center justify-between gap-2 text-left transition-all duration-150 cursor-pointer ${buttonSizeClass()} ${
          props.disabled
            ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800"
            : isOpen()
              ? "bg-white dark:bg-slate-900 border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
              : "bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 text-slate-900 dark:text-slate-100 shadow-2xs"
        } ${props.buttonClass || ""}`}
      >
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <Show when={selectedOption()?.icon}>
            <span class="shrink-0 text-slate-500 dark:text-slate-400">
              {selectedOption()!.icon}
            </span>
          </Show>
          <div class="truncate flex items-center gap-2">
            <span
              class={`font-medium truncate ${
                selectedOption()
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {selectedOption() ? selectedOption()!.label : props.placeholder || "Select option..."}
            </span>
            <Show when={selectedOption()?.badge}>
              <span
                class={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono border font-semibold ${getBadgeClass(
                  selectedOption()!.badgeType,
                )}`}
              >
                {selectedOption()!.badge}
              </span>
            </Show>
          </div>
        </div>

        <ChevronDown
          size={size() === "sm" ? 13 : 15}
          class={`shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
            isOpen() ? "rotate-180 text-emerald-500" : ""
          }`}
        />
      </button>

      {/* Floating Popover Menu */}
      <Show when={isOpen()}>
        <div
          class={`absolute ${props.align === "right" ? "right-0" : "left-0"} z-50 mt-1.5 w-full min-w-50 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl py-1 overflow-hidden transition-all duration-150 animate-in fade-in-0 zoom-in-95 ${
            props.menuClass || ""
          }`}
          role="listbox"
        >
          {/* Optional Search Input if searchable or list is long */}
          <Show when={props.searchable || props.options.length > 7}>
            <div class="p-1.5 border-b border-slate-100 dark:border-slate-800/80">
              <div class="relative flex items-center">
                <Search size={13} class="absolute left-2.5 text-slate-400 dark:text-slate-500" />
                <input
                  ref={(el) => (searchInputRef = el)}
                  type="text"
                  value={search()}
                  onInput={(e) => {
                    setSearch(e.currentTarget.value);
                    setHighlightedIndex(0);
                  }}
                  placeholder="Search options..."
                  class="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </Show>

          {/* Options List */}
          <ul
            ref={(el) => (listRef = el)}
            class="max-h-60 overflow-y-auto py-1 divide-y-0"
            role="presentation"
          >
            <Show
              when={filteredOptions().length > 0}
              fallback={
                <li class="px-3 py-3 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                  {props.emptyText || "No options found"}
                </li>
              }
            >
              <For each={filteredOptions()}>
                {(option, idx) => {
                  const isSelected = () => option.value === props.value;
                  const isHighlighted = () => idx() === highlightedIndex();

                  return (
                    <li
                      role="option"
                      aria-selected={isSelected()}
                      onClick={() => handleSelect(option)}
                      onMouseEnter={() => setHighlightedIndex(idx())}
                      class={`px-3 py-2 text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        option.disabled ? "opacity-40 cursor-not-allowed" : ""
                      } ${
                        isSelected()
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold"
                          : isHighlighted()
                            ? "bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100"
                            : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div class="flex items-center gap-2 min-w-0 flex-1">
                        <Show when={option.icon}>
                          <span class="shrink-0 text-slate-500 dark:text-slate-400">
                            {option.icon}
                          </span>
                        </Show>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-2">
                            <span class="truncate">{option.label}</span>
                            <Show when={option.badge}>
                              <span
                                class={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono border font-semibold ${getBadgeClass(
                                  option.badgeType,
                                )}`}
                              >
                                {option.badge}
                              </span>
                            </Show>
                          </div>
                          <Show when={option.sublabel}>
                            <p class="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-normal">
                              {option.sublabel}
                            </p>
                          </Show>
                        </div>
                      </div>

                      <Show when={isSelected()}>
                        <Check
                          size={14}
                          class="shrink-0 text-emerald-600 dark:text-emerald-400 font-bold"
                        />
                      </Show>
                    </li>
                  );
                }}
              </For>
            </Show>
          </ul>
        </div>
      </Show>
    </div>
  );
};

export default Dropdown;
