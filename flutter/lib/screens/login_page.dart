import 'package:flutter/material.dart';
import 'package:grain/auth.dart';
import 'package:grain/widgets/app_button.dart';
import 'package:grain/widgets/app_image.dart';
import 'package:grain/widgets/plain_text_field.dart';
import 'package:url_launcher/url_launcher.dart';

class LoginPage extends StatefulWidget {
  final void Function()? onSignIn;
  const LoginPage({super.key, this.onSignIn});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final TextEditingController _handleController = TextEditingController(text: '');
  bool _signingIn = false;

  Future<void> _signInWithBluesky(BuildContext context) async {
    final handle = _handleController.text.trim();

    if (handle.isEmpty) return;
    setState(() {
      _signingIn = true;
    });

    try {
      await auth.login(handle);

      if (widget.onSignIn != null) {
        widget.onSignIn!();
      }
    } finally {
      setState(() {
        _signingIn = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: Stack(
        fit: StackFit.expand,
        children: [
          AppImage(
            url:
                'https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:bcgltzqazw5tb6k2g3ttenbj/bafkreiewhwu3ro5dv7omedphb62db4koa7qtvyzfhiiypg3ru4tvuxkrjy@jpeg',
            fit: BoxFit.cover,
          ),
          Container(color: Colors.black.withOpacity(0.4)),
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox(height: 24),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: PlainTextField(
                    label: '',
                    controller: _handleController,
                    hintText: 'Enter your handle or pds host',
                    enabled: !_signingIn,
                    onChanged: (_) {},
                  ),
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: SizedBox(
                    width: double.infinity,
                    child: AppButton(
                      label: 'Login',
                      onPressed: _signingIn ? null : () => _signInWithBluesky(context),
                      loading: _signingIn,
                      variant: AppButtonVariant.primary,
                      height: 44,
                      fontSize: 15,
                      borderRadius: 6,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.7),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    padding: const EdgeInsets.all(12),
                    child: Text(
                      'e.g., user.bsky.social, user.grain.social, example.com, https://pds.example.com',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          mainAxisAlignment: MainAxisAlignment.end,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Wrap(
                              crossAxisAlignment: WrapCrossAlignment.center,
                              spacing: 8,
                              runSpacing: 4,
                              children: [
                                const Text(
                                  '© 2025 Grain Social. All rights reserved.',
                                  style: TextStyle(color: Colors.white, fontSize: 12),
                                ),
                                _LinkText('Terms', 'https://grain.social/support/terms'),
                                const Text(
                                  '|',
                                  style: TextStyle(color: Colors.white, fontSize: 12),
                                ),
                                _LinkText('Privacy', 'https://grain.social/support/privacy'),
                                const Text(
                                  '|',
                                  style: TextStyle(color: Colors.white, fontSize: 12),
                                ),
                                _LinkText('Copyright', 'https://grain.social/support/copyright'),
                              ],
                            ),
                          ],
                        ),
                      ),
                      Flexible(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          mainAxisAlignment: MainAxisAlignment.end,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Wrap(
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                const Text(
                                  'Photo by ',
                                  style: TextStyle(color: Colors.white, fontSize: 12),
                                ),
                                _LinkText(
                                  '@chadtmiller.com',
                                  'https://grain.social/profile/chadtmiller.com',
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LinkText extends StatelessWidget {
  final String text;
  final String url;
  const _LinkText(this.text, this.url);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        final uri = Uri.parse(url);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri);
        } else {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Could not open link: $url')));
        }
      },
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          decoration: TextDecoration.underline,
        ),
      ),
    );
  }
}
