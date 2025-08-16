import 'package:flutter/material.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/app_logger.dart';

class LogPage extends StatelessWidget {
  const LogPage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final logs = InMemoryLogOutput.logs.reversed.toList();

    return Scaffold(
      appBar: AppBar(
        title: Text('Logs'),
        backgroundColor: theme.appBarTheme.backgroundColor,
        actions: [
          IconButton(
            icon: Icon(AppIcons.delete, color: theme.iconTheme.color),
            onPressed: () {
              InMemoryLogOutput.clear();
              (context as Element).markNeedsBuild();
            },
          ),
        ],
      ),
      backgroundColor: theme.scaffoldBackgroundColor,
      body: ListView.builder(
        itemCount: logs.length,
        itemBuilder: (_, index) => Padding(
          padding: const EdgeInsets.all(4.0),
          child: Text(logs[index], style: theme.textTheme.bodyMedium),
        ),
      ),
    );
  }
}
