# Deployment Instructions

## Environment Variables

To deploy this application to production, you need to set the following environment variables in your hosting dashboard:

### Required Environment Variables

1. **CLERK_PUBLISHABLE_KEY** - Your Clerk production publishable key (starts with `pk_live_`)
2. **ClerkSecretKey** - Your Clerk production secret key (starts with `sk_live_`)
3. **EncryptionKey** - A secure encryption key for API key storage (32 characters minimum)

### Setting Up Clerk Production Keys

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Go to API Keys section
4. Copy the Production keys (not Test keys)
5. Set them in your hosting environment variables

### Important Notes

- **Use production keys**: Development keys have strict rate limits (429 errors)
- **Security**: Never commit these keys to your repository
- **Encryption**: Generate a strong encryption key for API key storage

### Example Environment Variables

```
CLERK_PUBLISHABLE_KEY=pk_live_your_actual_key_here
ClerkSecretKey=sk_live_your_actual_secret_key_here
EncryptionKey=your_32_character_encryption_key_here
```

## Troubleshooting

### Common Issues

1. **429 Rate Limit Errors**: Switch from test keys to production keys
2. **CORS Errors**: Ensure your domain is added to Clerk's authorized origins
3. **Authentication Fails**: Verify production keys are set correctly
4. **500 Internal Errors**: Check that all environment variables are set

### Checking Deployment

After deployment, verify:
- [ ] Authentication works
- [ ] Project creation works
- [ ] AI chat functionality works
- [ ] API key management works
- [ ] No console errors related to CORS or authentication