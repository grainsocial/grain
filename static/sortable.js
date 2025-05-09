htmx.onLoad(function (content) {
  const sortables = content.querySelectorAll(".sortable");
  for (const sortable of sortables) {
    const sortableInstance = new Sortable(sortable, {
      animation: 150,
      swap: true,
      swapClass: "opacity-50",

      // Make the `.htmx-indicator` unsortable
      filter: ".htmx-indicator",
      onMove: function (evt) {
        console.log("onMove", evt);
        return evt.related.className.indexOf("htmx-indicator") === -1;
      },

      // Disable sorting on the `end` event
      onEnd: function (_evt) {
        console.log("onEnd");
        // this.option("disabled", true);
      },
    });

    // Re-enable sorting on the `htmx:afterSwap` event
    sortable.addEventListener("htmx:afterSwap", function () {
      //   sortableInstance.option("disabled", false);
    });
  }
});
