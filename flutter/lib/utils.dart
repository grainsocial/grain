String formatRelativeTime(String isoString) {
  final date = DateTime.tryParse(isoString);
  if (date == null) return '';
  final now = DateTime.now();
  final diff = now.difference(date);
  final weeks = diff.inDays ~/ 7;
  if (weeks > 0) return '${weeks}w';
  final days = diff.inDays;
  if (days > 0) return '${days}d';
  final hours = diff.inHours;
  if (hours > 0) return '${hours}h';
  final minutes = diff.inMinutes;
  return '${minutes < 1 ? 1 : minutes}m';
}
