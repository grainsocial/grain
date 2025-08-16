import 'package:logger/logger.dart';

class InMemoryLogOutput extends LogOutput {
  static final List<String> _logs = [];

  @override
  void output(OutputEvent event) {
    for (var line in event.lines) {
      _logs.add(line);
    }
  }

  static List<String> get logs => List.unmodifiable(_logs);
  static void clear() => _logs.clear();
}

class SimpleLogPrinter extends LogPrinter {
  final String className;

  SimpleLogPrinter(this.className);

  static const Map<Level, String> levelEmojis = {
    Level.trace: '🔍',
    Level.debug: '🐛',
    Level.info: '💡',
    Level.warning: '⚠️',
    Level.error: '❌',
    Level.fatal: '🔥',
  };

  @override
  List<String> log(LogEvent event) {
    final emoji = levelEmojis[event.level] ?? '';
    final message = '$emoji $className - ${event.message}';
    return [message]; // You can apply color here if needed
  }
}

class DualLogOutput extends LogOutput {
  final _inMemory = InMemoryLogOutput();
  final _console = ConsoleOutput();

  @override
  void output(OutputEvent event) {
    _inMemory.output(event);
    _console.output(event);
  }
}

// Globally available logger
final appLogger = Logger(printer: SimpleLogPrinter('Grain'), output: DualLogOutput());
