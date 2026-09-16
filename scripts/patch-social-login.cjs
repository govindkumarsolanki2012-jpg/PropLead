const fs = require('fs');
const path = require('path');

const targetFile = path.join(
  __dirname,
  '..',
  'node_modules',
  '@capgo',
  'capacitor-social-login',
  'android',
  'src',
  'main',
  'java',
  'ee',
  'forgr',
  'capacitor',
  'social',
  'login',
  'GoogleProvider.java'
);

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');

  // Replace getCredentialAsync(context, ...) with getCredentialAsync(activity, ...)
  if (content.includes('credentialManager.getCredentialAsync(\n            context,')) {
    content = content.replace(
      'credentialManager.getCredentialAsync(\n            context,',
      'credentialManager.getCredentialAsync(\n            activity,'
    );
  }

  // Remove retry loop on account reauth failure
  if (content.includes('handleAccountReauthFailed(e, call, config, options);')) {
    content = content.replace(
      'handleAccountReauthFailed(e, call, config, options);',
      'call.reject("Google Sign-In failed: " + errorMessage);'
    );
  }

  // Force GetSignInWithGoogleOption instead of GetGoogleIdOption
  const oldBranch = /if \(bottomUi\) \{[\s\S]*?requestBuilder\.addCredentialOption\(googleIdOptionBuilder\.build\(\)\);\s*\}/;
  if (oldBranch.test(content)) {
    const newImplementation = `// Explicit Sign in with Google flow using GetSignInWithGoogleOption
        GetSignInWithGoogleOption.Builder googleIdOptionBuilder = new GetSignInWithGoogleOption.Builder(this.clientId);

        if (!nonce.isEmpty()) {
            googleIdOptionBuilder.setNonce(nonce);
        }
        if (this.hostedDomain != null && !this.hostedDomain.isEmpty()) {
            googleIdOptionBuilder.setHostedDomainFilter(this.hostedDomain);
        }

        requestBuilder.addCredentialOption(googleIdOptionBuilder.build());`;
    content = content.replace(oldBranch, newImplementation);
  }

  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('[patch-social-login] Successfully patched GoogleProvider.java for GetSignInWithGoogleOption');
} else {
  console.log('[patch-social-login] GoogleProvider.java not found; skipping patch');
}
