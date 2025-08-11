import type { FunctionalComponent, JSX } from "preact";
import { Button } from "./Button.tsx";
import { cn } from "./utils.ts";

type DialogProps = JSX.HTMLAttributes<HTMLDivElement> & { _?: string } & {
  children: preact.ComponentChildren;
};

type DialogContentProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children: preact.ComponentChildren;
};

type DialogTitleProps = {
  children: preact.ComponentChildren;
};

type DialogCloseProps = JSX.HTMLAttributes<HTMLButtonElement> & {
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
        "tw:fixed tw:top-0 tw:bottom-0 tw:right-0 tw:left-0 tw:flex tw:items-center tw:justify-center tw:z-10",
        classProp,
      )}
      {...{
        _: `on closeDialog
              remove me
              remove .tw:pointer-events-none from document.body
              remove [@data-scroll-locked] from document.body
            on keyup[key is 'Escape'] from <body/> trigger closeDialog
            init
              add .tw:pointer-events-none to document.body
              add .tw:pointer-events-auto to me
              add [@data-scroll-locked=true] to document.body
            ${_}`,
      }}
      {...props}
    >
      <div
        class="tw:absolute tw:top-0 tw:left-0 tw:right-0 tw:bottom-0 tw:bg-black/80"
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
        "tw:w-[400px] tw:bg-white tw:flex tw:flex-col tw:p-4 tw:max-h-[calc(100vh-100px)] tw:sm:max-h-screen tw:overflow-y-auto tw:z-20",
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
    <h1 class="tw:text-lg tw:font-semibold tw:text-center tw:w-full tw:mb-2">
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
        "tw:absolute tw:top-4 tw:right-4 tw:h-4 tw:w-4 tw:cursor-pointer z-30 tw:fill-white",
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
