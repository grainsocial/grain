import "typed-htmx";

declare module "preact" {
  namespace JSX {
    interface HTMLAttributes extends HtmxAttributes {}
  }
}
