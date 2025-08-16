import 'package:flutter/material.dart';

class AppTheme {
  static const Color primaryColor = Color(0xFF0EA5E9);
  static const Color scaffoldBackgroundColor = Color(0xFFF8FAFC);
  static const Color favoriteColor = Color(0xFFEC4899);

  static final ThemeData lightTheme = ThemeData(
    brightness: Brightness.light,
    primaryColor: primaryColor,
    scaffoldBackgroundColor: scaffoldBackgroundColor,
    appBarTheme: const AppBarTheme(
      backgroundColor: scaffoldBackgroundColor,
      foregroundColor: Colors.black87,
      elevation: 0,
      iconTheme: IconThemeData(color: Colors.black87),
      titleTextStyle: TextStyle(color: Colors.black87, fontSize: 18, fontWeight: FontWeight.w600),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: primaryColor,
      foregroundColor: Colors.white,
      shape: CircleBorder(),
    ),
    dividerColor: Colors.grey[300],
    colorScheme: ColorScheme.light(
      primary: primaryColor,
      surface: Colors.grey[200]!,
      onSurface: Colors.black87,
      onSurfaceVariant: Colors.black54,
      onPrimary: Colors.white,
      onSecondary: Colors.black87,
      onError: Colors.redAccent,
    ),
    // Add more theme customizations as needed
  );

  static final ThemeData darkTheme = ThemeData(
    brightness: Brightness.dark,
    primaryColor: primaryColor,
    scaffoldBackgroundColor: Colors.black,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.black,
      foregroundColor: Colors.white,
      elevation: 0,
      iconTheme: IconThemeData(color: Colors.white),
      titleTextStyle: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: primaryColor,
      foregroundColor: Colors.white,
      shape: CircleBorder(),
    ),
    dividerColor: Colors.grey[900],
    colorScheme: ColorScheme.dark(
      primary: primaryColor,
      surface: Colors.grey[900]!,
      onSurface: Colors.white,
      onSurfaceVariant: Colors.white70,
      onPrimary: Colors.white,
      onSecondary: Colors.white,
      onError: Colors.redAccent,
    ),
    // Add more theme customizations as needed
  );
}
