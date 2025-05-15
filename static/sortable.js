htmx.onLoad(function (content) {
  const sortables = content.querySelectorAll(".sortable");
  for (const sortable of sortables) {
    new Sortable(sortable, {
      animation: 150,
    });
  }
});
