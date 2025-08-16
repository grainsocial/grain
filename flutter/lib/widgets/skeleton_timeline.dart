import 'package:flutter/material.dart';

class SkeletonTimeline extends StatelessWidget {
  final int itemCount;
  final bool useSliver;
  final EdgeInsetsGeometry padding;
  const SkeletonTimeline({
    super.key,
    this.itemCount = 6,
    this.useSliver = false,
    this.padding = const EdgeInsets.symmetric(vertical: 24, horizontal: 8),
  });

  @override
  Widget build(BuildContext context) {
    if (useSliver) {
      return SliverPadding(
        padding: padding,
        sliver: SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) => _buildSkeletonItem(context, index),
            childCount: itemCount,
          ),
        ),
      );
    } else {
      return ListView.builder(
        itemCount: itemCount,
        padding: padding,
        itemBuilder: (context, index) => _buildSkeletonItem(context, index),
      );
    }
  }

  Widget _buildSkeletonItem(BuildContext context, int index) {
    final theme = Theme.of(context);
    final Color skeletonColor = theme.colorScheme.surfaceContainerHighest.withAlpha(128);
    final double fade = 1.0 - (index / itemCount) * 0.3;
    final Color fadedColor = skeletonColor.withOpacity(fade);

    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: fadedColor, shape: BoxShape.circle),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(height: 14, width: 120, color: fadedColor),
                    const SizedBox(height: 6),
                    Container(height: 12, width: 80, color: fadedColor),
                  ],
                ),
              ),
              Container(height: 12, width: 40, color: fadedColor),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            height: 180,
            width: double.infinity,
            color: fadedColor,
            margin: const EdgeInsets.symmetric(horizontal: 2),
          ),
          const SizedBox(height: 12),
          Container(
            height: 16,
            width: 160,
            color: fadedColor,
            margin: const EdgeInsets.only(left: 2),
          ),
          const SizedBox(height: 8),
          Container(
            height: 12,
            width: double.infinity,
            color: fadedColor,
            margin: const EdgeInsets.only(left: 2),
          ),
          const SizedBox(height: 16),
          Row(
            children: List.generate(
              3,
              (i) => Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: fadedColor,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
