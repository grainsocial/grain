import { cn } from "@bigmoves/bff/components";
import type { FunctionalComponent, JSX } from "preact";
import { Button, ButtonProps } from "./Button.tsx";

type DialogProps = JSX.HTMLAttributes<HTMLDivElement> & { _?: string } & {
  children: preact.ComponentChildren;
};

type DialogContentProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children: preact.ComponentChildren;
};

type DialogTitleProps = {
  children: preact.ComponentChildren;
};

type DialogCloseProps = JSX.HTMLAttributes<HTMLButtonElement> & ButtonProps & {
  children: preact.ComponentChildren;
};

type DialogXProps = JSX.HTMLAttributes<HTMLButtonElement>;

const _closeOnClick = "on click trigger closeDialog";

const Dialog: FunctionalComponent<DialogProps> & {
  Content: FunctionalComponent<DialogContentProps>;
  Title: FunctionalComponent<DialogTitleProps>;
  Close: FunctionalComponent<DialogCloseProps>;
  X: FunctionalComponent<DialogXProps>;
  _closeOnClick: string;
} = ({ children, class: classProp, _ = "", ...props }) => {
  return (
    <div
      class={cn(
        "fixed top-0 bottom-0 right-0 left-0 flex items-center justify-center z-100",
        classProp,
      )}
      {...{
        _: `on closeDialog
              remove me
              remove .pointer-events-none from document.body
              remove [@data-scroll-locked] from document.body
            on keyup[key is 'Escape'] from <body/> trigger closeDialog
            init
              add .pointer-events-none to document.body
              add .pointer-events-auto to me
              add [@data-scroll-locked=true] to document.body
            ${_}`,
      }}
      {...props}
    >
      <div
        class="absolute top-0 left-0 right-0 bottom-0 bg-black/80"
        {...{
          _: _closeOnClick,
        }}
      />
      {children}
    </div>
  );
};

const DialogContent: FunctionalComponent<DialogContentProps> = (
  { children, class: classProp, ...props },
) => {
  return (
    <div
      class={cn(
        "w-[400px] bg-white dark:bg-zinc-900 rounded-md flex flex-col p-4 max-h-[calc(100vh-100px)] overflow-y-auto z-20 relative",
        classProp,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const DialogTitle: FunctionalComponent<DialogTitleProps> = ({ children }) => {
  return (
    <h1 class="text-lg font-semibold text-center w-full mb-2">
      {children}
    </h1>
  );
};

const DialogX: FunctionalComponent<DialogXProps> = ({
  class: classProp,
}) => {
  return (
    <button
      type="button"
      class={cn(
        "absolute top-4 right-4 h-4 w-4 cursor-pointer z-30 fill-white",
        classProp,
      )}
      {...{
        _: _closeOnClick,
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 384 512"
      >
        {/* <!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.-->*/}
        <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z" />
      </svg>
    </button>
  );
};

const DialogClose: FunctionalComponent<DialogCloseProps> = (
  { children, ...props },
) => {
  return (
    <Button
      {...{
        _: _closeOnClick,
      }}
      {...props}
    >
      {children}
    </Button>
  );
};

Dialog.Content = DialogContent;
Dialog.Title = DialogTitle;
Dialog.Close = DialogClose;
Dialog.X = DialogX;
Dialog._closeOnClick = _closeOnClick;

export { Dialog };
