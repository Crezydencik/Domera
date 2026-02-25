# 🔥 Firebase Setup Guide for Domera

## 1. ⚙️ Current Status
- ✅ Firebase Project: **domera-eb224**
- ✅ Firebase Credentials: Configured in `.env.local`
- ⚠️ **Firestore Rules: NEEDS UPDATE** (Rules are too restrictive)

## 2. 🚨 CRITICAL: Update Firestore Security Rules

### Why This Is Required:
The current Firestore rules in Firebase Console are blocking all Firestore operations. You must update them to allow authenticated users to read/write data.

### Steps to Update:
1. Go to **[Firebase Console](https://console.firebase.google.com/)**
2. Select project **domera-eb224**
3. Go to **Firestore Database** → **Rules** tab
4. **DELETE ALL EXISTING RULES** and replace with:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Allow authenticated users to read/write all collections (DEVELOPMENT MODE)
    function isAuthenticated() {
      return request.auth != null;
    }
    
    match /companies/{companyId} {
      allow read, write: if isAuthenticated();
    }
    
    match /users/{userId} {
      allow read, write: if isAuthenticated();
    }
    
    match /buildings/{buildingId} {
      allow read, write: if isAuthenticated();
    }
    
    match /apartments/{apartmentId} {
      allow read, write: if isAuthenticated();
    }
    
    match /meters/{meterId} {
      allow read, write: if isAuthenticated();
    }
    
    match /meter_readings/{readingId} {
      allow read, write: if isAuthenticated();
    }
    
    match /invoices/{invoiceId} {
      allow read, write: if isAuthenticated();
    }
    
    match /invitations/{invitationId} {
      allow read, write: if isAuthenticated();
    }
    
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

5. Click **Publish** button

### ⚠️ Important Notes:
- This is a **DEVELOPMENT** configuration
- Before going to **PRODUCTION**, implement strict role-based security rules
- See `/src/firebase/rules/firestore.rules` for future production rules

## 3. ✅ Verify Connection

After updating rules:

1. Open http://localhost:3000/test-login
2. Click "Создать тестовый аккаунт" button
3. You should see success message with test credentials
4. Try logging in with those credentials

## 4. 🔐 Production Security Rules (TODO)

Before deploying to production, implement these security requirements:
- [ ] Role-based access control (ManagementCompany, Resident, Accountant)
- [ ] Company-based data isolation
- [ ] Apartment-level access for residents
- [ ] Cloud Functions to set custom claims in auth token

## 5. 📝 Environment Variables

Verify `.env.local` contains:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCiBQKA5lu5hWXazA8wEl4YwP4vW_mxT7k
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=domera-eb224.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=domera-eb224
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=domera-eb224.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=310587877880
NEXT_PUBLIC_FIREBASE_APP_ID=1:310587877880:web:517209f7ba81a99a5ace0d
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-CJNEED38Y2
```

## 6. 🚀 Quick Start

```bash
cd domera

# Install dependencies
npm install

# Start the development server
npm run dev

# The app will be available at http://localhost:3000
```

## 7. 📞 Troubleshooting

### Issue: "Permission denied" errors when logging in
**Solution:** Update Firestore rules as described in Step 2

### Issue: Can't create test account
**Solution:** 
1. Check Firebase rules are updated
2. Open browser console (F12) for detailed errors
3. Check that `.env.local` has correct credentials

### Issue: Slow registration/login
**Solution:**
- This is normal for first request (cold start)
- Subsequent requests should be faster
- Check network tab in browser DevTools

## 8. 📚 Resources

- [Firebase Console](https://console.firebase.google.com/)
- [Firestore Security Rules Guide](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
