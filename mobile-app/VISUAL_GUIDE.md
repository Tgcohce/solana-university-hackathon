# 📸 Visual Guide - Keystore Wallet UI

## 🎨 Color Palette

```
Primary Purple:   #667eea  ████████
Deep Purple:      #764ba2  ████████
Accent Pink:      #f093fb  ████████
Success Green:    #10B981  ████████
Warning Orange:   #F59E0B  ████████
Error Red:        #EF4444  ████████
Background:       #f5f5f5  ████████
White:            #ffffff  ████████
```

## 📱 Screen Layouts

### 1. Onboarding Screen (Before Wallet Creation)

```
┌─────────────────────────────────────┐
│                                     │
│   [Gradient Background: Purple→Pink]│
│                                     │
│         ┌─────────────┐            │
│         │   🔒 Icon   │            │
│         │  (Shield)   │            │
│         └─────────────┘            │
│                                     │
│      Keystore Wallet                │
│   Biometric Solana Wallet          │
│                                     │
│  Create a secure wallet protected   │
│  by Face ID or fingerprint. Your   │
│  keys stay on your device.         │
│                                     │
│   ┌───────────────────────┐        │
│   │  ➕  Create Wallet    │        │
│   └───────────────────────┘        │
│                                     │
│   ✓ No seed phrases to remember    │
│   ✓ Biometric authentication       │
│   ✓ Secure hardware encryption     │
│                                     │
└─────────────────────────────────────┘
```

### 2. Wallet Dashboard (After Creation)

```
┌─────────────────────────────────────┐
│ [Gradient Header: Purple→Deep Purple]│
│                                     │
│  My Wallet              🔒          │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    Total Balance            │   │
│  │                             │   │
│  │     1.0000 SOL             │   │
│  │    ≈ $150.00 USD           │   │
│  └─────────────────────────────┘   │
│                                     │
│     [Bw7x...9kL2]  📋              │
│                                     │
└─────────────────────────────────────┘
│                                     │
│  ┌──────┐  ┌──────┐  ┌──────┐     │
│  │  ↑   │  │  ↓   │  │  🎁  │     │
│  │ Send │  │Receive│ │Airdrop│     │
│  └──────┘  └──────┘  └──────┘     │
│   Purple     Green     Orange      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🔒 Biometric Security       │   │
│  │ All transactions require    │   │
│  │ Face ID or fingerprint      │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🌐 Network                  │   │
│  │ Solana Devnet               │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

### 3. Send Transaction Modal

```
┌─────────────────────────────────────┐
│                                     │
│  Send SOL                    ✕     │
│                                     │
│  Amount (SOL)                       │
│  ┌─────────────────────────────┐   │
│  │ 0.00                        │   │
│  └─────────────────────────────┘   │
│                                     │
│  Recipient Address                  │
│  ┌─────────────────────────────┐   │
│  │ Solana address              │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  👤  Authenticate & Send    │   │
│  │      (Purple Button)        │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

### 4. About/Explore Screen

```
┌─────────────────────────────────────┐
│ [Gradient Header: Purple→Deep Purple]│
│                                     │
│           ✨                        │
│    Keystore Protocol                │
│  Biometric Key Infrastructure       │
│       for Solana                    │
│                                     │
└─────────────────────────────────────┘
│                                     │
│  🔐 What is Keystore?               │
│  Keystore is a biometric key        │
│  infrastructure service...          │
│                                     │
│  ┌──────────┐  ┌──────────┐        │
│  │   👤     │  │   🔒     │        │
│  │Biometric │  │ Hardware │        │
│  │   Auth   │  │ Security │        │
│  └──────────┘  └──────────┘        │
│                                     │
│  ┌──────────┐  ┌──────────┐        │
│  │   ⚡     │  │   🔑     │        │
│  │secp256r1 │  │    No    │        │
│  │          │  │   Seed   │        │
│  └──────────┘  └──────────┘        │
│                                     │
│  💡 How It Works                    │
│                                     │
│  ① Create Passkey                   │
│  User creates a passkey using       │
│  WebAuthn...                        │
│                                     │
│  ② Initialize Identity              │
│  Public key is registered...        │
│                                     │
│  ③ Sign Transactions                │
│  User authenticates with...         │
│                                     │
└─────────────────────────────────────┘
```

## 🎭 Component Styles

### Gradient Backgrounds
```css
Primary Gradient: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)
Header Gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
```

### Cards
```css
Background: #ffffff
Border Radius: 16px
Shadow: 0px 2px 8px rgba(0,0,0,0.1)
Padding: 20px
Gap: 12px
```

### Buttons
```css
Primary Button:
  Background: #667eea
  Color: #ffffff
  Border Radius: 12px
  Padding: 16px 32px
  Font Weight: 700
  
Action Buttons:
  Send: #667eea (Purple)
  Receive: #10B981 (Green)
  Airdrop: #F59E0B (Orange)
  Size: 64x64px circles
  Icon Size: 28px
```

### Typography
```css
Title: 36px, Weight 800, Color #ffffff
Subtitle: 18px, Weight 600, Color #ffffff
Section Title: 24px, Weight 800, Color #333333
Body: 16px, Weight 400, Color #666666
Caption: 14px, Weight 400, Color #666666
```

## 🎬 Animations

### Transitions
- **Modal Slide Up:** 300ms ease-out
- **Button Press:** Scale 0.95, 100ms
- **Balance Update:** Fade in, 500ms
- **Loading Spinner:** Continuous rotation

### States
- **Default:** Full opacity, normal scale
- **Hover:** Slight scale up (1.02)
- **Pressed:** Scale down (0.95)
- **Disabled:** 50% opacity
- **Loading:** Spinner animation

## 📐 Layout Specifications

### Spacing
```
Screen Padding: 24px
Card Gap: 16px
Element Gap: 12px
Section Gap: 32px
```

### Sizes
```
Icon Sizes:
  - Large: 80px (onboarding)
  - Medium: 60px (headers)
  - Small: 28px (buttons)
  - Tiny: 20px (inline)

Button Heights:
  - Primary: 56px
  - Secondary: 48px
  - Small: 40px

Card Heights:
  - Balance Card: Auto (min 120px)
  - Info Card: Auto (min 80px)
  - Feature Card: Auto (min 140px)
```

### Breakpoints
```
Mobile: < 768px (default)
Tablet: 768px - 1024px
Desktop: > 1024px (web only)
```

## 🎨 Icon Usage

### Primary Icons
- **Shield (🔒):** Security, protection
- **Wallet (💰):** Balance, funds
- **Face ID (👤):** Biometric auth
- **Arrow Up (↑):** Send transaction
- **Arrow Down (↓):** Receive funds
- **Gift (🎁):** Airdrop
- **Checkmark (✓):** Success, feature
- **Info (ℹ️):** Information
- **Copy (📋):** Copy address

### Icon Colors
- **Primary Actions:** White on colored background
- **Success:** #10B981
- **Warning:** #F59E0B
- **Error:** #EF4444
- **Info:** #667eea

## 🌈 Gradient Combinations

### Background Gradients
1. **Primary:** Purple → Deep Purple → Pink
2. **Header:** Purple → Deep Purple
3. **Card Hover:** Light Purple → Light Pink

### Button Gradients (Future Enhancement)
1. **Send:** Purple → Blue
2. **Receive:** Green → Teal
3. **Airdrop:** Orange → Yellow

## 📱 Platform Differences

### iOS
- Native SF Symbols icons
- Smooth spring animations
- Face ID / Touch ID prompts
- Haptic feedback

### Android
- Material Design icons (fallback)
- Standard animations
- Fingerprint prompts
- Vibration feedback

### Web
- Browser-based icons
- CSS transitions
- Windows Hello / Touch ID
- No haptic feedback

## 🎯 Design Principles

1. **Simplicity:** Clean, uncluttered interface
2. **Familiarity:** Banking app aesthetics
3. **Security:** Visual security indicators
4. **Feedback:** Clear loading and success states
5. **Accessibility:** High contrast, readable text
6. **Consistency:** Unified design language
7. **Delight:** Smooth animations, beautiful gradients

## 💡 Visual Hierarchy

### Level 1 (Most Important)
- Balance amount
- Primary action buttons
- Biometric prompts

### Level 2 (Secondary)
- Wallet address
- Transaction details
- Security information

### Level 3 (Supporting)
- Network status
- Feature descriptions
- Help text

## 🎨 Mood Board

**Inspiration:**
- Apple Pay (biometric UX)
- Revolut (modern banking UI)
- Phantom Wallet (crypto simplicity)
- Stripe (clean, professional)

**Feeling:**
- Trustworthy
- Modern
- Secure
- Approachable
- Premium

---

This visual guide ensures consistent design across all platforms and provides a reference for future development.

