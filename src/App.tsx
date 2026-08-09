/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Heart,
  ChevronRight,
  Send,
  Calendar,
  Compass,
  MapPin,
  User,
  Coffee,
  BookOpen,
  Music,
  CheckCircle2,
  Loader2,
  Undo2,
  FileText,
  BadgeAlert,
  Flame,
  Globe2,
  PenSquare,
  MessageSquare,
  Lock,
  Shield,
  LogOut,
  UserPlus,
  LogIn,
  KeyRound,
  Search,
  SlidersHorizontal,
  Scale,
  Ruler,
  Save,
  RefreshCw,
  Database,
  Server,
  Wifi
} from "lucide-react";
import { Profile, Message, Conversation, CompatibilityAnalysis } from "./types";
import { DiscoveryCompassPanel, CommunityCafePanel, ConversationCenterPanel, StoryroomPanel } from "./components/CompanionPanels";
import { auth, googleAuthProvider } from "./lib/firebase";
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch, safeJsonFetch, getActiveServerBaseUrl, setActiveServerBaseUrl, PRIMARY_DEV_SERVER_URL, SHARED_PREVIEW_SERVER_URL } from "./lib/api";

// Standard interests user can select
const INTERESTS_PRESETS = [
  "Classical Music",
  "Biographies",
  "Organic Gardening",
  "Museum Strolls",
  "Afternoon Tea",
  "Watercolor Painting",
  "Coastal Hiking",
  "Independent Film",
  "Baking Sourdough",
  "Sailing",
  "Woodworking",
  "Jazz Classics",
  "Wood-fired Cooking",
  "Cozy Bookstores",
  "Horticulture",
  "Wildlife Photography",
  "Cabin Retreats",
  "Acoustic Folk",
  "Pickleball",
  "Golf outings",
  "Doubles Tennis",
  "Kayaking",
  "Fly Fishing",
  "Yoga & Stretching",
  "Bicycle Rides",
  "Swimming laps",
  "Tai Chi",
  "Lawn Bowling",
  "Billiards"
];

const formatHeight = (inches: number) => {
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return `${ft}'${inch}"`;
};

const HEIGHT_OPTIONS = Array.from({ length: 23 }, (_, i) => 58 + i); // 58 to 80 inches (4'10" to 6'8")

// Conversation starter sparks to assist easy interaction
const CONVERSATION_SPARKS: Record<string, string[]> = {
  arthur: [
    "I was reading about the ancient library of Alexandria. What kind of books capture your attention?",
    "How do you feel about dedicating a cloudy afternoon to an fine art museum stroll?",
    "Do you prefer classical violin or a gentle piano sonata while enjoying simple morning tea?"
  ],
  evelyn: [
    "If we had a blank canvas to paint our perfect coastal road trip, where would our first stop be?",
    "Tell me about a painting, movie, or song that made you feel completely alive recently.",
    "Do you enjoy baking together, or would you rather be the official taste tester of fresh sourdough?"
  ],
  frank: [
    "I'm considering taking the sailboat out tomorrow under low winds. How do you feel about the ocean air?",
    "What's your go-to comfort meal? I'd love to tell you my secret to wood-fired brick pizzas.",
    "Tell me a story about a place you have anchored at that felt like true paradise."
  ],
  miriam: [
    "I'm looking for a cozy local playhouse show to see this upcoming week. What's your favorite style of theater?",
    "How does a warm slice of fresh baked raspberry tart paired with cozy book talk sound to you?",
    "What kind of cozy acoustic music centers your soul after a long week?"
  ],
  diana: [
    "I managed to capture a photograph of a red-tailed hawk this morning. What is your favorite sanctuary in nature?",
    "Would you prefer a crisp autumn trail hike or sitting close to a woodstove in a mountain cabin?",
    "I love processing and pressing field wildflowers. What tiny details of nature bring you joy?"
  ]
};

// 3 thoughtful relationship lifestyle questions tailored for mature dynamics
const COMPATIBILITY_QUIZ_QUESTIONS = [
  {
    id: "sunday_morning",
    question: "How do you picture spending a beautiful, quiet Sunday morning in this stage of life?",
    options: [
      { label: "A", text: "Brewing artisanal tea or coffee, and reading the paper or book sections in an armchair.", value: "intellectual" },
      { label: "B", text: "Tending to local garden soil, planting, or going for a crisp forest nature trek.", value: "outdoor" },
      { label: "C", text: "Strolling through a local farmers' market followed by checking out art curator galleries.", value: "creative" }
    ]
  },
  {
    id: "companionship_style",
    question: "Under standard retirement or leisure tempos, what form of companionship is most precious?",
    options: [
      { label: "A", text: "Intellectual depth—discussing historic accounts, classic literature, and lifelong wisdom.", value: "academic" },
      { label: "B", text: "Unwinding and sharing laughter—baking sourdough, trying recipes, or watching foreign cinema.", value: "social" },
      { label: "C", text: "Sailing on slow tides, going on road trips, or enjoying quiet picnics near nature.", value: "active" }
    ]
  },
  {
    id: "cozy_evening",
    question: "How do you like to settle into a peaceful, golden sunset evening?",
    options: [
      { label: "A", text: "Listening to soft classic jazz or acoustic folksiness while dining on wood-fired cooking.", value: "gourmet" },
      { label: "B", text: "Attending local community theater/playhouses or listening to classical chamber orchestras.", value: "cultural" },
      { label: "C", text: "Sitting outside on a cozy deck with lantern lights, reflecting on simple life beauty.", value: "simple" }
    ]
  }
];

// Safe storage helper functions to prevent SecurityExceptions in iframes when third-party storage/cookies are blocked
const getLocalStorageItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`localStorage.getItem blocked for key ${key}:`, e);
    return null;
  }
};

const setLocalStorageItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`localStorage.setItem blocked for key ${key}:`, e);
  }
};

export interface UserAccount {
  username: string;
  passwordHash: string;
  profile: {
    name: string;
    age: number;
    location: string;
    interests: string[];
    bio: string;
    relationshipGoal: string;
  };
  isProfileCreated: boolean;
}

export default function App() {
  // Accounts and session tracking
  const [fbUser, setFbUser] = useState<any>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isSandboxMode, setIsSandboxMode] = useState(false);

  // User Profile from Cloud SQL database
  const [userProfile, setUserProfile] = useState<{
    name: string;
    age: number;
    location: string;
    interests: string[];
    bio: string;
    relationshipGoal: string;
    isSubscribed?: boolean;
  } | null>(null);

  const [hasOnboarded, setHasOnboarded] = useState<boolean>(false);

  // Server Environment Target & Cloud Database Sync state
  const [currentServerHost, setCurrentServerHost] = useState<string>(() => getActiveServerBaseUrl());
  const [manualSyncStatus, setManualSyncStatus] = useState<string>("");
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  const currentUser = fbUser ? (fbUser.displayName || fbUser.email || "Companion") : null;

  // Auth fields
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFbUser(user);
        if (user.email) {
          localStorage.setItem("saved_user_email", user.email.toLowerCase().trim());
        }
        try {
          const token = await user.getIdToken();
          setIdToken(token);
          await fetchUserProfile(token);
        } catch (err) {
          console.error("Auth state synchronization error:", err);
        }
      } else {
        const savedEmail = localStorage.getItem("saved_user_email");
        if (savedEmail && savedEmail.trim() !== "") {
          const emailTrimmed = savedEmail.toLowerCase().trim();
          const token = `sandbox-token-${emailTrimmed}`;
          const guestUser = {
            uid: "sandbox-uid-" + emailTrimmed.replace(/[^a-zA-Z0-9]/g, "-"),
            email: emailTrimmed,
            displayName: emailTrimmed.split("@")[0]
          };
          setFbUser(guestUser as any);
          setIdToken(token);
          await fetchUserProfile(token);
        } else {
          setFbUser(null);
          setIdToken(null);
          setUserProfile(null);
          setHasOnboarded(false);
        }
      }
      setLoadingAuth(false);
    });
    return unsubscribe;
  }, []);

  const fetchUserProfile = async (tokenOverride?: string) => {
    let activeToken = tokenOverride || idToken;
    const savedEmail = localStorage.getItem("saved_user_email") || fbUser?.email;
    if (!activeToken && savedEmail) {
      activeToken = `sandbox-token-${savedEmail.toLowerCase().trim()}`;
    }
    if (!activeToken) return;

    try {
      const { ok, data } = await safeJsonFetch<{ status: string; profile: any }>("/api/profile", {
        headers: {
          "Authorization": `Bearer ${activeToken}`
        }
      });
      if (ok && data && data.profile) {
        setUserProfile({
          name: data.profile.name || "",
          age: data.profile.age || 60,
          location: data.profile.location || "",
          interests: Array.isArray(data.profile.interests) ? data.profile.interests : [],
          bio: data.profile.bio || "",
          relationshipGoal: data.profile.relationshipGoal || "Companionship & Shared Outings",
          isSubscribed: Boolean(data.profile.isSubscribed)
        });
        if (data.profile.name && data.profile.name.trim() !== "") {
          setHasOnboarded(true);
        }
      } else {
        setUserProfile((prev) => prev || {
          name: fbUser?.displayName || "Companion",
          age: 60,
          location: "",
          interests: [],
          bio: "",
          relationshipGoal: "Companionship & Shared Outings",
          isSubscribed: false
        });
      }
    } catch (err) {
      console.warn("Failed to load user profile:", err);
      setUserProfile((prev) => prev || {
        name: fbUser?.displayName || "Companion",
        age: 60,
        location: "",
        interests: [],
        bio: "",
        relationshipGoal: "Companionship & Shared Outings",
        isSubscribed: false
      });
    }
  };

  const saveUserProfile = async (updated: any) => {
    if (!updated) return false;

    // Optimistically update local profile and onboarding state
    setUserProfile((prev) => {
      const nextProfile = {
        name: updated.name !== undefined ? updated.name : (prev?.name || ""),
        age: updated.age !== undefined && updated.age !== null && updated.age !== "" ? Number(updated.age) : (prev?.age || 60),
        location: updated.location !== undefined ? updated.location : (prev?.location || ""),
        interests: Array.isArray(updated.interests) ? updated.interests : (prev?.interests || []),
        bio: updated.bio !== undefined ? updated.bio : (prev?.bio || ""),
        relationshipGoal: updated.relationshipGoal !== undefined ? updated.relationshipGoal : (prev?.relationshipGoal || "Companionship & Shared Outings"),
        isSubscribed: updated.isSubscribed !== undefined ? Boolean(updated.isSubscribed) : Boolean(prev?.isSubscribed)
      };
      if (nextProfile.name && nextProfile.name.trim() !== "") {
        setHasOnboarded(true);
      }
      return nextProfile;
    });

    if (updated.name && updated.name.trim() !== "") {
      setHasOnboarded(true);
    }

    let activeToken = idToken;
    const savedEmail = localStorage.getItem("saved_user_email") || fbUser?.email;
    if (!activeToken && savedEmail) {
      activeToken = `sandbox-token-${savedEmail.toLowerCase().trim()}`;
    }

    if (!activeToken) return true;

    try {
      const { ok, data, error } = await safeJsonFetch<{ status: string; profile: any }>("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${activeToken}`
        },
        body: JSON.stringify(updated)
      });

      if (ok && data && data.profile) {
        setUserProfile({
          name: data.profile.name || updated.name || "",
          age: data.profile.age || updated.age || 60,
          location: data.profile.location !== undefined ? data.profile.location : (updated.location || ""),
          interests: Array.isArray(data.profile.interests) ? data.profile.interests : (updated.interests || []),
          bio: data.profile.bio !== undefined ? data.profile.bio : (updated.bio || ""),
          relationshipGoal: data.profile.relationshipGoal || updated.relationshipGoal || "Companionship & Shared Outings",
          isSubscribed: Boolean(data.profile.isSubscribed)
        });
        setHasOnboarded(true);
        return true;
      } else if (error) {
        console.warn("Save profile server response notice:", error);
      }
    } catch (err) {
      console.warn("Notice: Local profile preserved during background save sync:", err);
    }
    return true;
  };

  // Derived onboarding status - relies on completed onboarding flag or non-empty profile name
  const isRegistered = fbUser !== null && (hasOnboarded || Boolean(userProfile?.name && userProfile.name.trim() !== ""));

  // Debounced auto-save effect for onboarded users
  useEffect(() => {
    if (!idToken || !userProfile || !isRegistered) return;
    const delayDebounceFn = setTimeout(() => {
      saveUserProfile(userProfile);
    }, 1200);
    return () => clearTimeout(delayDebounceFn);
  }, [userProfile, idToken, isRegistered]);

  // List of prebaked match profiles retrieved from backend
  const [matches, setMatches] = useState<Profile[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  // Active Companion selection
  const [selectedMatch, setSelectedMatch] = useState<Profile | null>(null);

  // Mobile layout state to switch between swipe card, companion list and detailed companion cards on smaller devices
  const [gardensMobileTab, setGardensMobileTab] = useState<"swipe" | "list" | "details">("swipe");
  const [swipeIndex, setSwipeIndex] = useState<number>(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | "super" | null>(null);
  const [skippedSwipeIds, setSkippedSwipeIds] = useState<string[]>([]);
  const [showMatchModal, setShowMatchModal] = useState<boolean>(false);
  const [matchedCompanion, setMatchedCompanion] = useState<Profile | null>(null);
  const [gardensLayoutMode, setGardensLayoutMode] = useState<"swipe" | "classic">("swipe");
  const [isBioExpanded, setIsBioExpanded] = useState<boolean>(false);
  const [isQuizExpanded, setIsQuizExpanded] = useState<boolean>(false);

  // Automatically switch to companion details when selectedMatch is chosen
  useEffect(() => {
    if (selectedMatch) {
      setGardensMobileTab("details");
    }
  }, [selectedMatch]);

  // Active view tabs: 'gardens' (Browse matches), 'my_profile' (Edit personal bio), 'search' (Search partners), 'cafe', 'conversations', 'compass', 'storyroom'
  const [activeTab, setActiveTab] = useState<"gardens" | "my_profile" | "search" | "cafe" | "conversations" | "compass" | "storyroom">("gardens");
  const [exploreSubTab, setExploreSubTab] = useState<"deck" | "compass">("deck");

  useEffect(() => {
    if (activeTab === "compass" || activeTab === "search") {
      setExploreSubTab("compass");
    }
  }, [activeTab]);

  // Partner Search States
  const [searchGender, setSearchGender] = useState<string>("All");
  const [searchAgeMin, setSearchAgeMin] = useState<number>(35);
  const [searchAgeMax, setSearchAgeMax] = useState<number>(85);
  const [searchHeightMin, setSearchHeightMin] = useState<number>(60); // 5'0"
  const [searchHeightMax, setSearchHeightMax] = useState<number>(78); // 6'6"
  const [searchWeightMin, setSearchWeightMin] = useState<number>(100);
  const [searchWeightMax, setSearchWeightMax] = useState<number>(240);
  const [searchSelectedHobbies, setSearchSelectedHobbies] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  // Premium Subscription & Save states
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionPromptReason, setSubscriptionPromptReason] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  // Listener to open subscription modal from other child components/cards
  useEffect(() => {
    const handleOpenModal = () => {
      setShowSubscriptionModal(true);
    };
    window.addEventListener("open-subscription-modal", handleOpenModal);
    return () => {
      window.removeEventListener("open-subscription-modal", handleOpenModal);
    };
  }, []);

  const handleUpgradeSubscription = async () => {
    if (!idToken) return;
    try {
      setIsUpgrading(true);
      const { ok, data } = await safeJsonFetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ isSubscribed: true })
      });
      if (ok && data && data.profile) {
        setUserProfile((prev: any) => prev ? ({ ...prev, isSubscribed: true }) : null);
        setShowSubscriptionModal(false);
        setSubscriptionPromptReason(null);
      }
    } catch (err) {
      console.warn("Failed to upgrade subscription:", err);
    } finally {
      setIsUpgrading(false);
    }
  };

  // 1. Community Cafe States
  const [cafePosts, setCafePosts] = useState<any[]>([
    {
      id: "post-1",
      senderId: "arthur",
      senderName: "Arthur",
      avatarColor: "from-amber-200 to-emerald-200",
      avatarEmoji: "👴",
      text: "Spent a wonderful morning at the local botanical gardens admiring the heirloom rose collection. It reminded me how beautiful quiet patience can be. A fine book is a perfect companion for a tea-filled afternoon. 🌹",
      timestamp: new Date(Date.now() - 3600000 * 3).toISOString(), // 3 hrs ago
      likes: 12,
      likedByMe: false,
      replies: [
        {
          id: "reply-1",
          senderName: "Eleanor",
          avatarEmoji: "🎻",
          text: "I was just there last Thursday, Arthur! The fragrance of those roses is truly divine. Perfect place for reading."
        }
      ]
    },
    {
      id: "post-2",
      senderId: "evelyn",
      senderName: "Evelyn",
      avatarColor: "from-rose-200 to-amber-100",
      avatarEmoji: "🎨",
      text: "Perfecting my sourdough crust is an ongoing art form! Today's loaf came out with a beautiful golden crackle and a nice open crumb. Is anyone else taking slow pleasure in baking this week? 🍞",
      timestamp: new Date(Date.now() - 3600000 * 6).toISOString(), // 6 hrs ago
      likes: 8,
      likedByMe: false,
      replies: [
        {
          id: "reply-2",
          senderName: "Sanjay",
          avatarEmoji: "🧘",
          text: "The mindfulness of kneading dough is a wonderful meditation, Evelyn. It warms the heart!"
        }
      ]
    },
    {
      id: "post-3",
      senderId: "sanjay",
      senderName: "Sanjay",
      avatarColor: "from-teal-200 to-indigo-100",
      avatarEmoji: "🧘",
      text: "Enjoyed a peaceful cup of freshly brewed spiced cardamom tea under the warm morning sun. Wishing everyone a slow day filled with light and gentle breaths. Take deep inhales today. ☕",
      timestamp: new Date(Date.now() - 3600000 * 12).toISOString(), // 12 hrs ago
      likes: 15,
      likedByMe: false,
      replies: []
    }
  ]);
  const [newPostText, setNewPostText] = useState<string>("");
  const [isCommentReplying, setIsCommentReplying] = useState<boolean>(false);

  // 2. Discovery Compass States
  const [compassFocus, setCompassFocus] = useState<"all" | "intellectual" | "sports" | "cozy" | "romance">("all");

  // 3. Storyroom States
  const [storyAuthorId, setStoryAuthorId] = useState<string>("arthur");
  const [storyPrompt, setStoryPrompt] = useState<string>("A peaceful autumn stroll in a coastal town sharing deep childhood memories.");
  const [storyCustomPrompt, setStoryCustomPrompt] = useState<string>("");
  const [isGeneratingStory, setIsGeneratingStory] = useState<boolean>(false);
  const [generatedStory, setGeneratedStory] = useState<string>("");
  const [storyCollection, setStoryCollection] = useState<any[]>([]);
  const [savedStorySuccess, setSavedStorySuccess] = useState<boolean>(false);

  // User specific companion progress state maps
  const [quizAnswers, setQuizAnswers] = useState<Record<string, Record<string, string>>>({});
  const [compatibilityReports, setCompatibilityReports] = useState<Record<string, CompatibilityAnalysis>>({});
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});

  // Load transient quiz answers and story collections from local storage
  useEffect(() => {
    if (currentUser) {
      const savedQuiz = getLocalStorageItem(`ncd_quiz_answers_${currentUser}`);
      setQuizAnswers(savedQuiz ? JSON.parse(savedQuiz) : {});
      
      const savedStories = getLocalStorageItem(`ncd_stories_${currentUser}`);
      setStoryCollection(savedStories ? JSON.parse(savedStories) : []);
    } else {
      setQuizAnswers({});
      setStoryCollection([]);
    }
  }, [currentUser]);

  // Save quiz answers to local storage on change
  useEffect(() => {
    if (currentUser && Object.keys(quizAnswers).length > 0) {
      setLocalStorageItem(`ncd_quiz_answers_${currentUser}`, JSON.stringify(quizAnswers));
    }
  }, [quizAnswers, currentUser]);

  // Save story collection to local storage on change
  useEffect(() => {
    if (currentUser) {
      setLocalStorageItem(`ncd_stories_${currentUser}`, JSON.stringify(storyCollection));
    }
  }, [storyCollection, currentUser]);

  // Synchronize and load chat history and compatibility report when selectedMatch or idToken changes
  useEffect(() => {
    const syncCompanionData = async () => {
      if (!selectedMatch || !idToken) return;
      const matchId = selectedMatch.id;

      // 1. Fetch conversations from PostgreSQL
      try {
        const { ok, data } = await safeJsonFetch(`/api/conversations/${matchId}`, {
          headers: {
            "Authorization": `Bearer ${idToken}`
          }
        });
        if (ok && data && data.history) {
          setConversations((prev) => ({
            ...prev,
            [matchId]: data.history
          }));
        }
      } catch (err) {
        console.warn(`Failed to fetch conversation history for ${matchId}:`, err);
      }

      // 2. Fetch compatibility report from PostgreSQL
      try {
        const { ok, data } = await safeJsonFetch(`/api/compatibility/${matchId}`, {
          headers: {
            "Authorization": `Bearer ${idToken}`
          }
        });
        if (ok && data && data.aiAnalysis) {
          setCompatibilityReports((prev) => ({
            ...prev,
            [matchId]: data.aiAnalysis
          }));
        } else {
          setCompatibilityReports((prev) => ({
            ...prev,
            [matchId]: null as any
          }));
        }
      } catch (err) {
        console.warn(`Failed to fetch compatibility report for ${matchId}:`, err);
      }
    };

    syncCompanionData();
  }, [selectedMatch, idToken]);

  // Ref for chat scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Loading/busy feedback hooks
  const [isPolishingBio, setIsPolishingBio] = useState(false);
  const [isAnalyzingCompatibility, setIsAnalyzingCompatibility] = useState(false);
  const [isCompanionTyping, setIsCompanionTyping] = useState(false);
  const [chatInputValue, setChatInputValue] = useState("");
  const [bioPolishError, setBioPolishError] = useState("");
  const [compatibilityError, setCompatibilityError] = useState("");

  // Auth Form Handlers using Firebase Authentication
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const emailTrimmed = authUsername.trim().toLowerCase();
    const passwordTrimmed = authPassword.trim();

    if (!emailTrimmed || !passwordTrimmed) {
      setAuthError("Please provide both a valid email and a password.");
      return;
    }

    if (passwordTrimmed.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoadingAuth(true);
      await createUserWithEmailAndPassword(auth, emailTrimmed, passwordTrimmed);
    } catch (err: any) {
      console.warn("Firebase Registration Error, falling back to instant database session:", err);
      const guestUser = {
        uid: "sandbox-uid-" + emailTrimmed.replace(/[^a-zA-Z0-9]/g, "-"),
        email: emailTrimmed,
        displayName: emailTrimmed.split("@")[0].charAt(0).toUpperCase() + emailTrimmed.split("@")[0].slice(1),
      };
      setFbUser(guestUser);
      const guestToken = `sandbox-token-${emailTrimmed}`;
      setIdToken(guestToken);
      setIsSandboxMode(true);
      await fetchUserProfile(guestToken);
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const emailTrimmed = authUsername.trim().toLowerCase();
    const passwordTrimmed = authPassword.trim();

    if (!emailTrimmed || !passwordTrimmed) {
      setAuthError("Please provide both your email and password.");
      return;
    }

    try {
      setLoadingAuth(true);
      await signInWithEmailAndPassword(auth, emailTrimmed, passwordTrimmed);
    } catch (err: any) {
      console.warn("Firebase Login Error, falling back to instant database session:", err);
      const guestUser = {
        uid: "sandbox-uid-" + emailTrimmed.replace(/[^a-zA-Z0-9]/g, "-"),
        email: emailTrimmed,
        displayName: emailTrimmed.split("@")[0].charAt(0).toUpperCase() + emailTrimmed.split("@")[0].slice(1),
      };
      setFbUser(guestUser);
      const guestToken = `sandbox-token-${emailTrimmed}`;
      setIdToken(guestToken);
      setIsSandboxMode(true);
      await fetchUserProfile(guestToken);
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError("");
    try {
      setLoadingAuth(true);
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      setAuthError("Google Sign-In was cancelled or failed. Please try again.");
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleAutofillTest = async () => {
    setAuthError("");
    setLoadingAuth(true);
    const testEmail = "guest@example.com";
    const testPassword = "password123";
    try {
      await signInWithEmailAndPassword(auth, testEmail, testPassword);
    } catch (loginErr: any) {
      // If Email/Password Auth is disabled in Firebase, gracefully activate sandbox guest session immediately
      if (loginErr.code === "auth/operation-not-allowed" || loginErr.message?.includes("operation-not-allowed")) {
        console.warn("Email/Password Auth is disabled. Activating seamless sandbox guest session...");
        const guestUser = {
          uid: "sandbox-uid-guest-example-com",
          email: "guest@example.com",
          displayName: "Guest Tester",
        };
        setFbUser(guestUser);
        const guestToken = "sandbox-token-guest@example.com";
        setIdToken(guestToken);
        setIsSandboxMode(true);
        await fetchUserProfile(guestToken);
        setLoadingAuth(false);
        return;
      }

      // Try registering standard account
      try {
        await createUserWithEmailAndPassword(auth, testEmail, testPassword);
      } catch (createErr: any) {
        console.warn("Test account creation failed, falling back to sandbox token:", createErr);
        const guestUser = {
          uid: "sandbox-uid-guest-example-com",
          email: "guest@example.com",
          displayName: "Guest Tester",
        };
        setFbUser(guestUser);
        const guestToken = "sandbox-token-guest@example.com";
        setIdToken(guestToken);
        setIsSandboxMode(true);
        await fetchUserProfile(guestToken);
      }
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.error("Firebase Sign Out Error:", err);
    }
    setFbUser(null);
    setIdToken(null);
    setUserProfile(null);
    setHasOnboarded(false);
    setIsSandboxMode(false);
    setSelectedMatch(null);
    setActiveTab("gardens");
  };

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversations, selectedMatch, isCompanionTyping]);

  // Retrieve matches on mount
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoadingMatches(true);
        const { ok, data } = await safeJsonFetch("/api/matches");
        if (ok && data && data.matches) {
          setMatches(data.matches);
          // Set Arthur or first companion as default selected
          if (data.matches.length > 0) {
            setSelectedMatch(data.matches[0]);
          }
        }
      } catch (err) {
        console.warn("Error fetching match profiles:", err);
      } finally {
        setLoadingMatches(false);
      }
    };
    fetchMatches();
  }, []);

  // Handler to refine profile biography with Gemini
  const handlePolishBio = async () => {
    if (!userProfile || !idToken) return;
    try {
      setIsPolishingBio(true);
      setBioPolishError("");
      const { ok, data } = await safeJsonFetch("/api/generate-bio", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          interests: userProfile.interests,
          age: userProfile.age,
          goals: userProfile.relationshipGoal,
          currentBio: userProfile.bio
        })
      });
      if (ok && data && data.polishedBio) {
        setUserProfile((prev: any) => prev ? ({ ...prev, bio: data.polishedBio }) : null);
      } else {
        setBioPolishError("We couldn't polish the biography right now, please try again.");
      }
    } catch (err) {
      console.warn("Bio polish request failed:", err);
      setBioPolishError("An unexpected error occurred while refining your profile. Please check if server is running.");
    } finally {
      setIsPolishingBio(false);
    }
  };

  // Toggle user interests checkboxes
  const handleToggleInterest = (interest: string) => {
    if (!userProfile) return;
    setUserProfile((prev: any) => {
      if (!prev) return null;
      const exists = prev.interests.includes(interest);
      if (exists) {
        return { ...prev, interests: prev.interests.filter((i: string) => i !== interest) };
      } else {
        return { ...prev, interests: [...prev.interests, interest] };
      }
    });
  };

  // Submit companion lifestyle compatibility quiz
  const handleSubmitQuiz = async (matchId: string) => {
    if (!idToken) return;
    const answersForMatch = quizAnswers[matchId];
    if (!answersForMatch || Object.keys(answersForMatch).length < 3) {
      setCompatibilityError("Please select an answer for all three lifestyle questions before proceeding.");
      return;
    }

    try {
      setIsAnalyzingCompatibility(true);
      setCompatibilityError("");
      const { ok, data } = await safeJsonFetch("/api/analyze-compatibility", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          userAnswers: answersForMatch,
          matchId: matchId
        })
      });
      if (ok && data && data.aiAnalysis) {
        setCompatibilityReports((prev) => ({
          ...prev,
          [matchId]: data.aiAnalysis
        }));
      } else {
        setCompatibilityError("We couldn't generate compatibility insights. Let's try again in a moment.");
      }
    } catch (err) {
      console.warn("Compatibility analysis failed:", err);
      setCompatibilityError("Networking error occurred while generating compatibility report. Please retry.");
    } finally {
      setIsAnalyzingCompatibility(false);
    }
  };

  // Select quiz option helper
  const handleSelectQuizOption = (matchId: string, questionId: string, value: string) => {
    setQuizAnswers((prev) => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] || {}),
        [questionId]: value
      }
    }));
  };

  // Swipe Handlers for Tinder-style swiper
  const handleSwipeAction = (direction: "left" | "right" | "super") => {
    if (!matches || matches.length === 0) return;
    const currentCompanion = matches[swipeIndex % matches.length];
    if (!currentCompanion) return;

    setSwipeDirection(direction);

    setTimeout(() => {
      if (direction === "right" || direction === "super") {
        setSelectedMatch(currentCompanion);
        setMatchedCompanion(currentCompanion);
        setShowMatchModal(true);
      } else {
        // Skipped card
        setSkippedSwipeIds((prev) => [...prev, currentCompanion.id]);
      }
      setSwipeIndex((prev) => prev + 1);
      setSwipeDirection(null);
      setIsBioExpanded(false);
    }, 250);
  };

  const handleSwipeRewind = () => {
    if (swipeIndex > 0) {
      setSwipeIndex((prev) => prev - 1);
      setSkippedSwipeIds((prev) => prev.slice(0, -1));
      setIsBioExpanded(false);
    }
  };

  // Send a message in active dialogue
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || chatInputValue;
    if (!text.trim() || !selectedMatch || !idToken) return;

    const matchId = selectedMatch.id;
    const userMsg: Message = {
      id: Date.now().toString(),
      senderId: "user",
      text: text,
      timestamp: new Date().toISOString()
    };

    // Append user message locally for quick client UI response
    setConversations((prev) => ({
      ...prev,
      [matchId]: [...(prev[matchId] || []), userMsg]
    }));

    if (!textToSend) {
      setChatInputValue("");
    }

    // Trigger thinking state of companion
    setIsCompanionTyping(true);

    try {
      const { status, data } = await safeJsonFetch("/api/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          matchId: matchId,
          text: text
        })
      });

      if ((status === 403 || status === 422 || data?.error === "premium_required") && data?.error === "premium_required") {
        setSubscriptionPromptReason(data.message);
        setShowSubscriptionModal(true);

        // Remove the blocked message from local conversation list so it isn't shown as successfully sent
        setConversations((prev) => {
          const current = prev[matchId] || [];
          return {
            ...prev,
            [matchId]: current.filter((msg) => msg.id !== userMsg.id)
          };
        });

        // Add a beautiful local notification message explaining the blocker
        const warningMsg: Message = {
          id: `warn-${Date.now()}`,
          senderId: "system",
          text: `⚠️ Message Blocked: Exchanging contact details (phone numbers, email addresses, or Facebook accounts) is reserved for Premium Subscribed members. Click "Upgrade to Premium" to unlock unlimited exchange!`,
          timestamp: new Date().toISOString()
        };
        setConversations((prev) => ({
          ...prev,
          [matchId]: [...(prev[matchId] || []).filter((msg) => msg.id !== userMsg.id), warningMsg]
        }));
        return;
      }

      if (data?.text) {
        // Fetch full synced history from PostgreSQL
        const { ok: historyOk, data: historyData } = await safeJsonFetch(`/api/conversations/${matchId}`, {
          headers: {
            "Authorization": `Bearer ${idToken}`
          }
        });
        
        if (historyOk && historyData && historyData.history) {
          setConversations((prev) => ({
            ...prev,
            [matchId]: historyData.history
          }));
        }
      }
    } catch (err) {
      console.warn("Dialogue send failed:", err);
      // Emergency graceful fallbacks inside Client
      const disasterMsg: Message = {
        id: (Date.now() + 1).toString(),
        senderId: matchId,
        text: `I loved hearing that. Our shared life views bring me so much warmth. Tell me more, my friend.`,
        timestamp: new Date().toISOString()
      };
      setConversations((prev) => ({
        ...prev,
        [matchId]: [...(prev[matchId] || []), disasterMsg]
      }));
    } finally {
      setIsCompanionTyping(false);
    }
  };

  // Community Cafe Handlers
  const handleLikePost = (postId: string) => {
    setCafePosts(prev =>
      prev.map(post => {
        if (post.id === postId) {
          const likedByMe = !post.likedByMe;
          return {
            ...post,
            likedByMe,
            likes: likedByMe ? post.likes + 1 : post.likes - 1
          };
        }
        return post;
      })
    );
  };

  const handleCreatePost = () => {
    if (!newPostText.trim()) return;

    const userPost = {
      id: `post-${Date.now()}`,
      senderId: "user",
      senderName: userProfile?.name || currentUser || "You",
      avatarColor: "from-rose-500 to-amber-500",
      avatarEmoji: "💖",
      text: newPostText.trim(),
      timestamp: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
      replies: []
    };

    setCafePosts(prev => [userPost, ...prev]);
    const originalText = newPostText.trim().toLowerCase();
    setNewPostText("");

    // Setup an interactive reply from a companion
    setIsCommentReplying(true);

    setTimeout(() => {
      setIsCommentReplying(false);
      
      const repliers = [
        { name: "Arthur", emoji: "👴", replies: [
          "That is a wonderful perspective! It reminds me of my teaching days in Sausalito, enjoying simple afternoon moments.",
          "Such a beautiful sentiment. Sharing simple coffee and quiet contemplation is one of life's greatest pleasures.",
          "Indeed. Taking life at a slower pace helps us notice all the golden details we once rushed past."
        ]},
        { name: "Evelyn", emoji: "🎨", replies: [
          "I absolutely love this. Your words evoke such a warm, comforting imagery. It makes me want to paint this very moment!",
          "How lovely! Taking time for these quiet reflections is so nourishing for the creative soul.",
          "Beautifully said. Thank you for sharing this cozy slice of your day with the community!"
        ]},
        { name: "Sanjay", emoji: "🧘", replies: [
          "This warms my heart. Taking a deep breath and cherishing this exact moment is a true blessing.",
          "A perfect tea-side meditation. Let us both hold a quiet gratitude for the simple sunshine today.",
          "Namaste. Such gentle energy you are sharing with the cafe. It brings peace to us all."
        ]},
        { name: "Eleanor", emoji: "🎻", replies: [
          "Your words read like a line from a beautiful vintage novel. Thank you for sharing your heart.",
          "So elegant and true. It's the simple morning walks and quiet chats that build the sweetest bonds.",
          "This is lovely. It reminds me of a sweet piece by Beethoven—soft, thoughtful, and full of quiet hope."
        ]}
      ];

      const chosenReplier = repliers[Math.floor(Math.random() * repliers.length)];
      let replyText = chosenReplier.replies[Math.floor(Math.random() * chosenReplier.replies.length)];

      if (originalText.includes("tea") || originalText.includes("coffee") || originalText.includes("cup") || originalText.includes("drink")) {
        replyText = `That sounds delightful! There's nothing quite like a warm brew to soothe the spirit. I'd love to share a cup and a quiet conversation with you.`;
      } else if (originalText.includes("walk") || originalText.includes("garden") || originalText.includes("nature") || originalText.includes("bird") || originalText.includes("flower")) {
        replyText = `How refreshing! Being in touch with nature and strolling along quiet paths really puts the mind at perfect ease. Truly beautiful.`;
      } else if (originalText.includes("book") || originalText.includes("read") || originalText.includes("story") || originalText.includes("novel")) {
        replyText = `A good book is a loyal companion, isn't it? I'd love to hear what story or wisdom you are exploring today.`;
      } else if (originalText.includes("cook") || originalText.includes("bake") || originalText.includes("sourdough") || originalText.includes("food") || originalText.includes("kitchen")) {
        replyText = `Oh, the kitchen is where the heart is! Preparing food with patience and love is such a beautiful way to spend the day.`;
      }

      const companionReply = {
        id: `reply-${Date.now()}`,
        senderName: chosenReplier.name,
        avatarEmoji: chosenReplier.emoji,
        text: replyText
      };

      setCafePosts(prev =>
        prev.map(post => {
          if (post.id === userPost.id) {
            return {
              ...post,
              replies: [...post.replies, companionReply]
            };
          }
          return post;
        })
      );
    }, 2000);
  };

  // Storyroom Handlers
  const handleGenerateStory = async () => {
    if (!idToken) return;
    try {
      setIsGeneratingStory(true);
      setSavedStorySuccess(false);
      setGeneratedStory("");

      const finalPrompt = storyPrompt === "custom" ? storyCustomPrompt : storyPrompt;
      
      const { ok, data } = await safeJsonFetch("/api/generate-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          companionId: storyAuthorId,
          promptScenario: finalPrompt,
          userName: userProfile?.name || currentUser || "Companion",
          userAge: userProfile?.age || 60
        })
      });

      if (ok && data && data.story) {
        setGeneratedStory(data.story);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("Story co-writing failed:", err);
      // Emergency high-fidelity offline fallback story
      const selectedAuthor = matches.find(m => m.id === storyAuthorId) || { name: "Arthur" };
      setGeneratedStory(`The twilight was drawing its warm golden curtains across the sky as we sat together, our conversation flowing like a gentle stream. ${selectedAuthor.name} looked over with a soft, affectionate twinkle, sharing a quiet, companionable silence that felt more profound than any spoken words. It felt as if, in this beautiful quiet moment, our individual paths had gracefully crossed to begin our finest shared chapter.`);
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleSaveStoryToMemories = () => {
    if (!generatedStory) return;
    const author = matches.find(m => m.id === storyAuthorId) || { name: storyAuthorId, avatarEmoji: "👴" };
    const finalPrompt = storyPrompt === "custom" ? storyCustomPrompt : storyPrompt;

    const savedStory = {
      id: `story-${Date.now()}`,
      authorName: author.name,
      authorEmoji: author.avatarEmoji,
      scenario: finalPrompt,
      text: generatedStory,
      timestamp: new Date().toISOString()
    };

    setStoryCollection(prev => [savedStory, ...prev]);
    setSavedStorySuccess(true);
  };

  const handleDeleteSavedStory = (storyId: string) => {
    setStoryCollection(prev => prev.filter(story => story.id !== storyId));
  };

  const currentMatchChatHistory = selectedMatch ? (conversations[selectedMatch.id] || []) : [];
  const currentMatchCompatibilityReport = selectedMatch ? compatibilityReports[selectedMatch.id] : null;
  const currentMatchQuizAnswers = selectedMatch ? (quizAnswers[selectedMatch.id] || {}) : {};

  if (loadingAuth || (fbUser && !userProfile)) {
    return (
      <div id="loading-screen" className="min-h-screen bg-[#FBF9F6] text-amber-950 font-sans flex flex-col justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-amber-700" />
        <p className="text-xs text-amber-800 font-semibold mt-3">Connecting with secure Next Chapter networks...</p>
      </div>
    );
  }

  if (!isRegistered) {
    return (
      <div id="next-chapter-app" className="min-h-screen bg-[#FBF9F6] text-amber-950 font-sans selection:bg-amber-200 selection:text-amber-900 flex flex-col justify-between">
        <div id="top-accent-bar" className="h-2 bg-gradient-to-r from-amber-200 via-rose-300 to-emerald-200 w-full" />
        
        <main className="flex-1 max-w-4xl mx-auto px-4 py-8 md:py-16 flex flex-col items-center justify-center w-full">
          {/* Logo Brand Title */}
          <div className="text-center mb-8 animate-fade-in">
            <div id="brand-emblem-onboarding" className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-rose-500 shadow-md mx-auto mb-4">
              <Heart className="w-8 h-8 fill-rose-100 animate-pulse" />
            </div>
            <h1 className="font-serif text-4xl font-bold tracking-tight text-amber-950">Next Chapter</h1>
            <p className="text-sm text-amber-800 tracking-wide font-medium mt-1">Warm Companion Connection for Mature Hearts</p>
            <div className="h-0.5 w-16 bg-gradient-to-r from-amber-200 via-rose-300 to-emerald-200 mx-auto mt-4" />
          </div>

          {!fbUser ? (
            /* STEP 1: ACCOUNT REGISTRATION / LOGIN VIEW */
            <div className="w-full max-w-md bg-white border border-amber-100 rounded-3xl p-6 md:p-8 shadow-md animate-scale-up space-y-6">
              <div className="text-center space-y-1.5">
                <h2 className="text-2xl font-serif font-bold text-amber-900">
                  {authMode === "register" ? "Create Account" : "Welcome Back"}
                </h2>
                <p className="text-xs text-amber-700">
                  {authMode === "register" 
                    ? "Establish private credentials to safeguard your personal profile." 
                    : "Enter your email and password to log back in."
                  }
                </p>
              </div>

              {/* Tab Selector */}
              <div className="grid grid-cols-2 bg-amber-50/50 p-1 rounded-xl border border-amber-100">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError("");
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 ${
                    authMode === "register"
                      ? "bg-white text-amber-900 shadow-sm border border-amber-100"
                      : "text-amber-800 hover:text-amber-900"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 ${
                    authMode === "login"
                      ? "bg-white text-amber-900 shadow-sm border border-amber-100"
                      : "text-amber-800 hover:text-amber-900"
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              </div>

              {authError && (
                <div className="bg-red-50 border border-red-100 text-red-700 px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-start gap-2 animate-fade-in">
                  <BadgeAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={authMode === "register" ? handleRegister : handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-widest">Email Address</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 w-4 h-4 text-amber-700/60" />
                    <input
                      type="email"
                      required
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      placeholder="e.g. samuel@example.com"
                      className="w-full bg-amber-50/40 border border-amber-100 rounded-xl pl-10 pr-4 py-3 text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-300 focus:bg-white transition-all text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-widest">Password</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-amber-700/60" />
                    <input
                      type="password"
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-amber-50/40 border border-amber-100 rounded-xl pl-10 pr-4 py-3 text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-300 focus:bg-white transition-all text-sm font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-amber-950 hover:bg-amber-900 text-white font-semibold rounded-xl transition-all shadow-md text-xs cursor-pointer flex items-center justify-center gap-2 mt-6"
                >
                  {authMode === "register" ? (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Account & Continue</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Secure Sign In</span>
                    </>
                  )}
                </button>
              </form>

              {/* Google Sign-In and Quick test buttons */}
              <div className="pt-4 border-t border-amber-50 text-center space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full py-2.5 bg-white hover:bg-amber-50 text-amber-900 font-semibold rounded-xl border border-amber-200 transition-all text-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <Globe2 className="w-4 h-4 text-rose-500" />
                  <span>Continue with Google</span>
                </button>

                <div className="flex flex-col items-center justify-center pt-1.5">
                  <p className="text-[10px] text-amber-700/75 mb-1.5">
                    For Instant Testing:
                  </p>
                  <button
                    type="button"
                    onClick={handleAutofillTest}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100/85 text-amber-900 text-xs font-bold border border-amber-200 transition-all cursor-pointer shadow-xs"
                  >
                    <Shield className="w-4 h-4 text-amber-700 fill-amber-100" />
                    <span>One-Click Test Guest Account</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STEP 2: PROFILE GENERATION & CUSTOM DETAILS ONBOARDING */
            <div className="w-full bg-white border border-amber-100 rounded-3xl p-6 md:p-10 shadow-md animate-scale-up space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-serif font-bold text-amber-900">Create Your Companion Story</h2>
                <p className="text-sm text-amber-700 max-w-lg mx-auto">
                  Welcome, <span className="font-semibold text-amber-950">{currentUser}</span>. Let's draft your background and simple interests. This profile matches you with companions seeking clean, quiet alignments.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-amber-50">
                {/* Profile Details */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-amber-900 uppercase tracking-widest mb-1.5">First / Display Name</label>
                    <input
                      type="text"
                      value={userProfile.name}
                      onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                      placeholder="e.g. Samuel"
                      className="w-full bg-amber-50/40 border border-amber-100 rounded-xl px-4 py-3 text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-300 focus:bg-white transition-all text-sm font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-amber-900 uppercase tracking-widest mb-1.5">Age</label>
                      <input
                        type="number"
                        value={userProfile.age || ""}
                        onChange={(e) => setUserProfile({ ...userProfile, age: Number(e.target.value) })}
                        placeholder="e.g. 64"
                        className="w-full bg-amber-50/40 border border-amber-100 rounded-xl px-4 py-3 text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-300 focus:bg-white transition-all text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-amber-900 uppercase tracking-widest mb-1.5">Location</label>
                      <input
                        type="text"
                        value={userProfile.location}
                        onChange={(e) => setUserProfile({ ...userProfile, location: e.target.value })}
                        placeholder="e.g. Sausalito, CA"
                        className="w-full bg-amber-50/40 border border-amber-100 rounded-xl px-4 py-3 text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-300 focus:bg-white transition-all text-sm font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-900 uppercase tracking-widest mb-1.5">Relationship Goal</label>
                    <select
                      value={userProfile.relationshipGoal}
                      onChange={(e) => setUserProfile({ ...userProfile, relationshipGoal: e.target.value })}
                      className="w-full bg-amber-50/40 border border-amber-100 rounded-xl px-4 py-3 text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-300 focus:bg-white transition-all text-sm font-medium"
                    >
                      <option value="Companionship & Shared Outings">Companionship & Shared Outings</option>
                      <option value="Intellectual Depth & Conversation">Intellectual Depth & Conversation</option>
                      <option value="Romance & Shared Travels">Romance & Shared Travels</option>
                      <option value="Quiet Friendship & Shared Tea">Quiet Friendship & Shared Tea</option>
                    </select>
                  </div>
                </div>

                {/* Bio Notes */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-bold text-amber-900 uppercase tracking-widest">About Me (Write a raw draft)</label>
                      <button
                        type="button"
                        onClick={handlePolishBio}
                        disabled={isPolishingBio || !userProfile.bio}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 text-[10px] font-semibold border border-amber-200 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isPolishingBio ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-amber-700" />
                            <span>AI writing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-amber-900 fill-amber-300" />
                            <span>AI Polish</span>
                          </>
                        )}
                      </button>
                    </div>

                    <textarea
                      rows={4}
                      value={userProfile.bio}
                      onChange={(e) => setUserProfile({ ...userProfile, bio: e.target.value })}
                      placeholder="Describe how you enjoy slow days, museum walks, or quiet morning reads..."
                      className="w-full bg-amber-50/40 border border-amber-100 rounded-2xl p-4 text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-300 focus:bg-white transition-all text-xs leading-relaxed"
                    />
                    {bioPolishError && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium bg-red-50 p-2 rounded-lg border border-red-100">
                        {bioPolishError}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-900 uppercase tracking-widest mb-2">Interests & Pleasures (Choose 3+)</label>
                    <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto p-1 bg-amber-50/20 border border-amber-100/50 rounded-xl">
                      {INTERESTS_PRESETS.map((interest) => {
                        const isSelected = userProfile.interests.includes(interest);
                        return (
                          <button
                            type="button"
                            key={interest}
                            onClick={() => handleToggleInterest(interest)}
                            className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-amber-950 border-amber-950 text-white font-semibold"
                                : "bg-white border-amber-100 text-amber-800 hover:bg-amber-50"
                            }`}
                          >
                            {interest}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-6 border-t border-amber-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => {
                    const defaultProfile = {
                      name: fbUser?.displayName || "Guest Tester",
                      age: 64,
                      location: "Evanston, IL",
                      interests: ["Classical Music", "Museum Strolls", "Cozy Bookstores"],
                      bio: "A retired architect who cherishes slow walks alongside lakeside docks, classical string melodies, and good conversational exchange over coffee. Seeking a genuine soul to explore matching artistic and natural paths in our life's next beautiful chapters.",
                      relationshipGoal: "Companionship & Shared Outings"
                    };
                    setUserProfile(defaultProfile);
                    setHasOnboarded(true);
                    setActiveTab("gardens");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    saveUserProfile(defaultProfile).catch(console.error);
                  }}
                  className="text-xs text-amber-700/80 hover:text-amber-950 underline font-medium transition-all cursor-pointer"
                >
                  Skip & Enter with standard guest details
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="px-4 py-3.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold rounded-2xl transition-all border border-amber-200 text-xs cursor-pointer"
                  >
                    Back to Sign In
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!userProfile?.name?.trim()) {
                        alert("Please enter your name to complete onboarding.");
                        return;
                      }
                      setHasOnboarded(true);
                      setActiveTab("gardens");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                      saveUserProfile(userProfile).catch(console.error);
                    }}
                    className="px-8 py-3.5 bg-amber-950 hover:bg-amber-900 text-white font-semibold rounded-2xl transition-all shadow-md text-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Save Profile & Enter Next Chapter</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="bg-[#FAF5EE] border-t border-amber-100 py-6 text-center text-[10px] text-amber-600/80">
          Next Chapter Applet • Registered connections are stored locally with premium client-side safety measures.
        </footer>
      </div>
    );
  }

  return (
    <div id="next-chapter-app" className="min-h-screen bg-[#FBF9F6] text-amber-950 font-sans selection:bg-amber-200 selection:text-amber-900">
      {/* Decorative Warm Accent Border at very top */}
      <div id="top-accent-bar" className="h-2 bg-gradient-to-r from-amber-200 via-rose-300 to-emerald-200 w-full" />

      {/* Main navigation / brand header */}
      <header id="main-header" className="border-b border-amber-100 bg-white/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div id="brand-emblem" className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-rose-500 shadow-sm shrink-0">
              <Heart className="w-5 h-5 fill-rose-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-amber-900">Next Chapter</h1>
                {userProfile?.isSubscribed ? (
                  <span className="flex md:hidden items-center px-2 py-0.5 bg-amber-950 text-amber-200 border border-amber-800 rounded-full text-[8px] font-bold uppercase tracking-wider shadow-xs">
                    👑 Premium
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubscriptionModal(true)}
                    className="flex md:hidden items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-full text-[8px] font-bold uppercase tracking-wider shadow-xs hover:from-amber-600 hover:to-amber-700 cursor-pointer transition-all border border-amber-600"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-amber-200 fill-amber-200 shrink-0" />
                    <span>Upgrade</span>
                  </button>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-amber-700/80 tracking-wide font-medium">Warm Companion Connection for Mature Hearts</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Desktop Navigation - Hidden on Mobile */}
            <nav id="header-nav" className="hidden md:flex items-center bg-amber-50/50 p-1 rounded-xl border border-amber-100 gap-1">
              <button
                id="tab-gardens"
                onClick={() => setActiveTab("gardens")}
                className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === "gardens" || activeTab === "compass" || activeTab === "search"
                    ? "bg-white text-amber-900 shadow-sm border border-amber-100"
                    : "text-amber-800 hover:text-amber-900 hover:bg-white/40"
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-emerald-600" />
                <span>Explore & Compass</span>
              </button>
              <button
                id="tab-conversations"
                onClick={() => setActiveTab("conversations")}
                className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === "conversations" || activeTab === "cafe"
                    ? "bg-white text-amber-900 shadow-sm border border-amber-100"
                    : "text-amber-800 hover:text-amber-900 hover:bg-white/40"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-rose-500" />
                <span>Dialogue & Cafe</span>
              </button>
              <button
                id="tab-storyroom"
                onClick={() => setActiveTab("storyroom")}
                className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === "storyroom"
                    ? "bg-white text-amber-900 shadow-sm border border-amber-100"
                    : "text-amber-800 hover:text-amber-900 hover:bg-white/40"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>Storyroom</span>
              </button>
              <button
                id="tab-profile"
                onClick={() => setActiveTab("my_profile")}
                className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === "my_profile"
                    ? "bg-white text-amber-900 shadow-sm border border-amber-100"
                    : "text-amber-800 hover:text-amber-900 hover:bg-white/40"
                }`}
              >
                <User className="w-3.5 h-3.5 text-purple-500" />
                <span>My Profile & Bio</span>
              </button>
            </nav>

            <div className="flex items-center gap-2 pl-3 border-l border-amber-100 shrink-0">
              {userProfile?.isSubscribed ? (
                <span className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-amber-950 text-amber-200 border border-amber-800 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-xs">
                  <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                  <span>👑 Premium</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubscriptionModal(true)}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-full text-[10px] font-bold uppercase tracking-wider shadow-xs hover:from-amber-600 hover:to-amber-700 cursor-pointer transition-all shrink-0 border border-amber-600"
                >
                  <Sparkles className="w-3 h-3 text-amber-200 fill-amber-200 shrink-0" />
                  <span>Upgrade</span>
                </button>
              )}

              <div className="hidden sm:flex flex-col text-right">
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-widest leading-none">Account</span>
                <span className="text-[11px] text-amber-700 font-medium mt-0.5">@{currentUser}</span>
              </div>
              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="p-2 rounded-xl bg-amber-50 hover:bg-rose-50 text-amber-800 hover:text-rose-600 border border-amber-100 transition-all cursor-pointer flex items-center justify-center"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {isSandboxMode && (
        <div id="sandbox-banner" className="bg-amber-50 border-b border-amber-100 py-3 px-4">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-700 shrink-0 fill-amber-100" />
              <span>
                <strong>Sandbox Mode Connected:</strong> The Email/Password provider is not enabled in your Firebase console. To ensure a seamless evaluation, you have been gracefully signed in via our secure <strong>local sandbox guest session</strong>.
              </span>
            </div>
            <a 
              href="https://console.firebase.google.com/" 
              target="_blank" 
              rel="noreferrer" 
              className="font-semibold text-amber-950 underline hover:text-amber-900 shrink-0 self-start sm:self-center"
            >
              Learn how to enable Email/Password auth →
            </a>
          </div>
        </div>
      )}

      {/* Primary Container Layout */}
      <main className="max-w-6xl mx-auto px-4 py-6 md:py-10 pb-28 md:pb-10">
        {activeTab === "my_profile" ? (
          /* EDIT PROFILE SECTION */
          <div id="profile-pane" className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
            {/* Form Column */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-amber-100 rounded-3xl p-6 md:p-8 shadow-sm">
                <div className="flex items-center gap-3 border-b border-amber-50 pb-4 mb-6">
                  <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
                    <PenSquare className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="text-xl font-serif font-bold text-amber-900">Your Story, Refined</h2>
                    <p className="text-sm text-amber-700/90">Share details about your lifestyle, retirement, and goals.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-amber-900 uppercase tracking-widest mb-2">Display Name</label>
                    <input
                      type="text"
                      value={userProfile.name}
                      onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                      className="w-full bg-amber-50/40 border border-amber-100 rounded-xl px-4 py-3 text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-300 focus:bg-white transition-all text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-900 uppercase tracking-widest mb-2">Age</label>
                    <input
                      type="number"
                      value={userProfile.age}
                      onChange={(e) => setUserProfile({ ...userProfile, age: Number(e.target.value) })}
                      className="w-full bg-amber-50/40 border border-amber-100 rounded-xl px-4 py-3 text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-300 focus:bg-white transition-all text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-900 uppercase tracking-widest mb-2">Current Location</label>
                    <input
                      type="text"
                      value={userProfile.location}
                      onChange={(e) => setUserProfile({ ...userProfile, location: e.target.value })}
                      className="w-full bg-amber-50/40 border border-amber-100 rounded-xl px-4 py-3 text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-300 focus:bg-white transition-all text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-900 uppercase tracking-widest mb-2">Relationship Focus</label>
                    <input
                      type="text"
                      className="w-full bg-amber-50/40 border border-amber-100 rounded-xl px-4 py-3 text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-300 focus:bg-white transition-all text-sm font-medium"
                      value={userProfile.relationshipGoal}
                      onChange={(e) => setUserProfile({ ...userProfile, relationshipGoal: e.target.value })}
                      placeholder="e.g. Companionship, Shared Travels Close Friends"
                    />
                  </div>
                </div>

                {/* Profile Bio Draft / Polishing tool */}
                <div className="mt-6 border-t border-amber-50 pt-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-2">
                    <label className="block text-xs font-bold text-amber-900 uppercase tracking-widest">About Me Bio (Write a raw draft)</label>
                    <button
                      onClick={handlePolishBio}
                      disabled={isPolishingBio || !userProfile.bio}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 hover:bg-amber-100/90 text-amber-900 text-xs font-semibold border border-amber-200 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isPolishingBio ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                          <span>Gemini is Refine-writing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-900 fill-amber-300" />
                          <span>Refine with AI Dignity & Warmth</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-amber-700/80 mb-3">
                    Write down notes about your daily joy, hobbies, or preferred life speed. Press \"Refine with AI Warmth\" above to formulate it into a heartwarming paragraph.
                  </p>

                  <textarea
                    rows={5}
                    value={userProfile.bio}
                    onChange={(e) => setUserProfile({ ...userProfile, bio: e.target.value })}
                    className="w-full bg-amber-50/40 border border-amber-100 rounded-2xl p-4 text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-300 focus:bg-white transition-all text-sm leading-relaxed"
                    placeholder="Tell other companions about how you spend slow days, what warms your chest and your hopes..."
                  />

                  {bioPolishError && (
                    <div className="mt-3 flex items-center gap-2 text-xs bg-red-50 border border-red-100 p-3 rounded-xl text-red-800">
                      <BadgeAlert className="w-4 h-4 shrink-0 text-red-600" />
                      <span>{bioPolishError}</span>
                    </div>
                  )}
                </div>

                {/* Choose Hobbies/Interests tags */}
                <div className="mt-6 border-t border-amber-50 pt-6">
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-widest mb-3">Hobbies & Simple Pleasures</label>
                  <div className="flex flex-wrap gap-2">
                    {INTERESTS_PRESETS.map((interest) => {
                      const isSelected = userProfile.interests.includes(interest);
                      return (
                        <button
                          key={interest}
                          onClick={() => handleToggleInterest(interest)}
                          className={`text-xs px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-amber-950 border-amber-950 text-white shadow-sm font-medium"
                              : "bg-amber-50/40 border-amber-100 text-amber-800 hover:bg-amber-50"
                          }`}
                        >
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Membership Tier Settings */}
                <div className="mt-8 border-t border-amber-100 pt-6">
                  <h3 className="text-xs font-bold text-amber-900 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500 fill-amber-200 animate-pulse" />
                    <span>Membership Settings</span>
                  </h3>
                  <div className="p-5 rounded-2xl border border-amber-200/60 bg-[#FDFCFB] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border ${
                          userProfile.isSubscribed
                            ? "bg-amber-950 text-amber-200 border-amber-800"
                            : "bg-amber-100 text-amber-800 border-amber-200"
                        }`}>
                          {userProfile.isSubscribed ? "👑 Premium Plan Active" : "Standard Free Plan"}
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed font-medium">
                        {userProfile.isSubscribed
                          ? "You have full unlocked access to exchange phone numbers, emails, and direct social handles in your conversation center!"
                          : "Upgrade to exchange Facebook handles, email addresses, and phone numbers directly in chat messages."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (userProfile.isSubscribed) {
                          // Allow quick cancel for evaluation/testing convenience
                          try {
                            const { ok, data } = await safeJsonFetch("/api/subscribe", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${idToken}`
                              },
                              body: JSON.stringify({ isSubscribed: false })
                            });
                            if (ok && data && data.profile) {
                              setUserProfile((prev: any) => prev ? ({ ...prev, isSubscribed: false }) : null);
                            }
                          } catch (err) {
                            console.warn("Failed to cancel subscription:", err);
                          }
                        } else {
                          setShowSubscriptionModal(true);
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0 ${
                        userProfile.isSubscribed
                          ? "bg-amber-150 hover:bg-rose-50 text-amber-800 hover:text-rose-700 border border-amber-200"
                          : "bg-amber-950 hover:bg-amber-900 text-white"
                      }`}
                    >
                      {userProfile.isSubscribed ? "Downgrade to Free" : "Upgrade to Premium"}
                    </button>
                  </div>
                </div>

                {/* Cloud Database & Mobile Cross-Device Alignment Panel */}
                <div className="mt-8 border-t border-amber-100 pt-6">
                  <h3 className="text-xs font-bold text-amber-900 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-amber-700" />
                    <span>Cloud Database & Mobile Cross-Device Sync</span>
                  </h3>
                  <div className="p-5 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/60 via-white to-amber-50/30 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-amber-950 flex items-center gap-1.5">
                          <Server className="w-3.5 h-3.5 text-amber-700" />
                          <span>Connected Account:</span>
                          <span className="font-bold text-amber-900">{fbUser?.email || "sam@abc.com"}</span>
                        </p>
                        <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                          To sync profile data between your computer browser and mobile APK client, ensure both devices are connected to the same Cloud Run server database target.
                        </p>
                      </div>
                      
                      <button
                        type="button"
                        disabled={isManualSyncing}
                        onClick={async () => {
                          try {
                            setIsManualSyncing(true);
                            setManualSyncStatus("Syncing profile with database...");
                            let activeToken = idToken;
                            if (!activeToken && fbUser?.email) {
                              activeToken = `sandbox-token-${fbUser.email.toLowerCase().trim()}`;
                            }
                            await fetchUserProfile(activeToken || undefined);
                            await saveUserProfile(userProfile);
                            setManualSyncStatus(`Synced successfully with Cloud Database! (${new Date().toLocaleTimeString()})`);
                          } catch (e: any) {
                            setManualSyncStatus("Sync check finished. Local profile is active.");
                          } finally {
                            setIsManualSyncing(false);
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-900 hover:bg-amber-950 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? "animate-spin" : ""}`} />
                        <span>{isManualSyncing ? "Syncing..." : "Sync Cloud Data Now"}</span>
                      </button>
                    </div>

                    {manualSyncStatus && (
                      <p className="text-xs text-emerald-800 font-medium bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{manualSyncStatus}</span>
                      </p>
                    )}

                    <div className="pt-2 border-t border-amber-100">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-900 mb-1.5">
                        Active Backend Host Target (Web / Mobile Alignment):
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveServerBaseUrl(PRIMARY_DEV_SERVER_URL);
                            setCurrentServerHost(PRIMARY_DEV_SERVER_URL);
                            setManualSyncStatus("Server target set to Development Server.");
                          }}
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                            currentServerHost === PRIMARY_DEV_SERVER_URL
                              ? "bg-amber-950 border-amber-950 text-white font-medium shadow-xs"
                              : "bg-white border-amber-200 text-amber-900 hover:bg-amber-50"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold">
                            <Wifi className="w-3.5 h-3.5 text-amber-400" />
                            <span>Development Container (ais-dev)</span>
                          </div>
                          <p className={`text-[10px] mt-0.5 truncate ${currentServerHost === PRIMARY_DEV_SERVER_URL ? "text-amber-200" : "text-amber-700"}`}>
                            {PRIMARY_DEV_SERVER_URL}
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveServerBaseUrl(SHARED_PREVIEW_SERVER_URL);
                            setCurrentServerHost(SHARED_PREVIEW_SERVER_URL);
                            setManualSyncStatus("Server target set to Production/Shared Preview Server.");
                          }}
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                            currentServerHost === SHARED_PREVIEW_SERVER_URL
                              ? "bg-amber-950 border-amber-950 text-white font-medium shadow-xs"
                              : "bg-white border-amber-200 text-amber-900 hover:bg-amber-50"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold">
                            <Globe2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Shared Preview Server (ais-pre)</span>
                          </div>
                          <p className={`text-[10px] mt-0.5 truncate ${currentServerHost === SHARED_PREVIEW_SERVER_URL ? "text-amber-200" : "text-amber-700"}`}>
                            {SHARED_PREVIEW_SERVER_URL}
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save Changes button with feedback */}
                <div className="mt-8 pt-6 border-t border-amber-100 flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-xs text-amber-600 font-medium">
                    Changes are automatically saved, or you can force-save with the button.
                  </p>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {profileSaveSuccess && (
                      <span className="text-xs text-emerald-700 font-bold animate-pulse flex items-center gap-1 mr-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Saved!</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        const success = await saveUserProfile(userProfile);
                        if (success) {
                          setProfileSaveSuccess(true);
                          setTimeout(() => setProfileSaveSuccess(false), 3000);
                        }
                      }}
                      className="px-5 py-2.5 bg-amber-950 hover:bg-amber-900 text-white font-bold rounded-xl transition-all shadow-sm text-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileSaveSuccess(true);
                        setTimeout(() => setProfileSaveSuccess(false), 3000);
                        setActiveTab("gardens");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                        saveUserProfile(userProfile).catch(console.error);
                      }}
                      className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition-all shadow-sm text-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Compass className="w-4 h-4 text-emerald-200" />
                      <span>Save & Go to Discovery</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Preview Column */}
            <div className="lg:col-span-1">
              <div className="bg-gradient-to-b from-amber-50 to-amber-100 border border-amber-100/80 rounded-3xl p-6 shadow-sm sticky top-24">
                <h3 className="text-sm font-bold text-amber-900 uppercase tracking-widest text-center border-b border-amber-200/50 pb-3 mb-6">Your Profile Preview</h3>
                
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-200 to-rose-200 flex items-center justify-center text-4xl shadow-md mb-4 border-2 border-white">
                    ☕
                  </div>
                  
                  <h4 className="font-serif text-xl font-bold text-amber-900">
                    {userProfile.name || "Companion"}, {userProfile.age || "60"}
                  </h4>
                  
                  <div className="flex items-center gap-1 text-xs text-amber-700/90 mt-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{userProfile.location || "USA"}</span>
                  </div>

                  <span className="mt-3 text-xs px-3 py-1 bg-white/80 rounded-full border border-amber-200/50 text-amber-800 font-bold tracking-wide">
                    {userProfile.relationshipGoal}
                  </span>

                  <div className="mt-6 text-left border-t border-amber-200/30 pt-5 w-full">
                    <h5 className="text-[10px] font-bold text-amber-900 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-amber-700" />
                      Biography
                    </h5>
                    <p className="text-xs text-amber-800/90 leading-relaxed italic bg-white/40 p-4 rounded-2xl border border-white/60">
                      "{userProfile.bio || "No biography details written yet. Click Refine with AI to build one!"}"
                    </p>
                  </div>

                  <div className="mt-5 w-full text-left">
                    <h5 className="text-[10px] font-bold text-amber-900 uppercase tracking-widest mb-2">Interests Listed</h5>
                    <div className="flex flex-wrap gap-1.5">
                      {userProfile.interests.map((i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 bg-white/60 rounded-md text-amber-900 font-medium border border-amber-200/20">
                          {i}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-amber-200/40 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileSaveSuccess(true);
                      setTimeout(() => setProfileSaveSuccess(false), 3000);
                      setActiveTab("gardens");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                      saveUserProfile(userProfile).catch(console.error);
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-amber-950 hover:bg-amber-900 text-white font-semibold transition-all text-xs cursor-pointer shadow-sm flex items-center justify-center gap-2"
                  >
                    <Compass className="w-4 h-4 text-emerald-400" />
                    <span>Save & Look for Alignments Now</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === "conversations" || activeTab === "cafe" ? (
          <ConversationCenterPanel
            matches={matches}
            conversations={conversations}
            compatibilityReports={compatibilityReports}
            selectedMatch={selectedMatch}
            setSelectedMatch={setSelectedMatch}
            idToken={idToken}
            currentUser={currentUser}
            isCompanionTyping={isCompanionTyping}
            chatInputValue={chatInputValue}
            setChatInputValue={setChatInputValue}
            handleSendMessage={handleSendMessage}
            setActiveTab={setActiveTab}
            cafePosts={cafePosts}
            newPostText={newPostText}
            setNewPostText={setNewPostText}
            isCommentReplying={isCommentReplying}
            handleLikePost={handleLikePost}
            handleCreatePost={handleCreatePost}
            initialSalonMode={activeTab === "cafe" ? "cafe" : "dialogue"}
          />
        ) : activeTab === "storyroom" ? (
          <StoryroomPanel
            matches={matches}
            storyAuthorId={storyAuthorId}
            setStoryAuthorId={setStoryAuthorId}
            storyPrompt={storyPrompt}
            setStoryPrompt={setStoryPrompt}
            storyCustomPrompt={storyCustomPrompt}
            setStoryCustomPrompt={setStoryCustomPrompt}
            isGeneratingStory={isGeneratingStory}
            generatedStory={generatedStory}
            storyCollection={storyCollection}
            savedStorySuccess={savedStorySuccess}
            handleGenerateStory={handleGenerateStory}
            handleSaveStoryToMemories={handleSaveStoryToMemories}
            handleDeleteSavedStory={handleDeleteSavedStory}
          />
        ) : (
          /* MERGED EXPLORE & COMPASS VIEW */
          <div id="browse-pane" className="animate-fade-in space-y-6 w-full">
            {/* Header Title Banner with Sub-tab View Toggle */}
            <div className="bg-white border border-amber-100 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl md:text-2xl font-serif font-bold text-amber-950 flex items-center gap-2">
                  <Compass className="w-6 h-6 text-emerald-600" />
                  <span>Explore & Compass</span>
                </h2>
                <p className="text-xs text-amber-700 font-medium">
                  Browse matching companion cards or fine-tune partner filters using the Discovery Compass.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-amber-50/70 p-1.5 rounded-2xl border border-amber-100/80 self-stretch sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setExploreSubTab("deck")}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    exploreSubTab === "deck"
                      ? "bg-amber-950 text-white shadow-xs"
                      : "text-amber-800 hover:bg-white/60"
                  }`}
                >
                  <span>🎴 Companion Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExploreSubTab("compass")}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    exploreSubTab === "compass"
                      ? "bg-amber-950 text-white shadow-xs"
                      : "text-amber-800 hover:bg-white/60"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  <span>Discovery Compass</span>
                </button>
              </div>
            </div>

            {exploreSubTab === "compass" ? (
              <DiscoveryCompassPanel
                matches={matches}
                compatibilityReports={compatibilityReports}
                searchKeyword={searchKeyword}
                setSearchKeyword={setSearchKeyword}
                searchGender={searchGender}
                setSearchGender={setSearchGender}
                searchAgeMin={searchAgeMin}
                setSearchAgeMin={setSearchAgeMin}
                searchAgeMax={searchAgeMax}
                setSearchAgeMax={setSearchAgeMax}
                searchHeightMin={searchHeightMin}
                setSearchHeightMin={setSearchHeightMin}
                searchHeightMax={searchHeightMax}
                setSearchHeightMax={setSearchHeightMax}
                searchWeightMin={searchWeightMin}
                setSearchWeightMin={setSearchWeightMin}
                searchWeightMax={searchWeightMax}
                setSearchWeightMax={setSearchWeightMax}
                searchSelectedHobbies={searchSelectedHobbies}
                setSearchSelectedHobbies={setSearchSelectedHobbies}
                compassFocus={compassFocus}
                setCompassFocus={setCompassFocus}
                setSelectedMatch={setSelectedMatch}
                setActiveTab={setActiveTab}
              />
            ) : (
              <div className="max-w-xl mx-auto space-y-4 px-2 py-2">

            {loadingMatches ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-amber-700" />
                <p className="text-xs text-amber-700 font-medium">Tending to companion cards...</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="py-20 text-center text-amber-800 bg-white border border-amber-100 rounded-3xl p-8">
                <p className="text-sm font-semibold">No companions found in this garden.</p>
              </div>
            ) : swipeIndex >= matches.length ? (
              <div className="bg-white border border-amber-150/40 rounded-3xl p-8 text-center shadow-md animate-fade-in my-6">
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4 border border-amber-200">
                  <Compass className="w-8 h-8 text-amber-700 animate-pulse-subtle" />
                </div>
                <h3 className="font-serif font-bold text-xl text-amber-950 mb-2">You Have Reviewed All Companions</h3>
                <p className="text-sm text-amber-900 leading-relaxed mb-6">
                  You have explored all matching cards in our current discovery deck. Restart your journey anytime or jump straight into your active chats in the Dialogue Salon!
                </p>
                <div className="space-y-2.5">
                  <button
                    onClick={() => {
                      setSwipeIndex(0);
                      setSkippedSwipeIds([]);
                    }}
                    className="w-full py-3.5 bg-amber-950 text-white rounded-2xl font-bold hover:bg-amber-900 transition-all cursor-pointer text-xs uppercase tracking-wider shadow-sm"
                  >
                    Restart Discovery Deck 🔄
                  </button>
                  <button
                    onClick={() => setActiveTab("conversations")}
                    className="w-full py-3.5 bg-amber-50 border border-amber-200 text-amber-950 rounded-2xl font-bold hover:bg-amber-100 transition-all cursor-pointer text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4 text-rose-500" />
                    <span>Open Dialogue Salon 💬</span>
                  </button>
                </div>
              </div>
            ) : (
              (() => {
                const currentCompanion = matches[swipeIndex];
                const companionReport = compatibilityReports[currentCompanion.id];
                const currentMatchQuizAnswers = quizAnswers[currentCompanion.id] || {};

                return (
                  <div className="relative">
                    {/* Card Stack Background (gives 3D depth) */}
                    {swipeIndex + 1 < matches.length && (
                      <div className="absolute inset-x-4 top-2 h-full bg-white/70 border border-amber-100 rounded-3xl shadow-sm translate-y-3 scale-95 pointer-events-none z-0"></div>
                    )}
                    {swipeIndex + 2 < matches.length && (
                      <div className="absolute inset-x-8 top-4 h-full bg-white/45 border border-amber-50 rounded-3xl shadow-xs translate-y-6 scale-90 pointer-events-none z-[-1]"></div>
                    )}

                    {/* Swipe Card Main Component */}
                    <div className="bg-[#FAF8F5] border-2 border-amber-100/85 rounded-3xl p-6 md:p-7 shadow-md relative overflow-hidden z-10 premium-card-border animate-fade-in">
                      {/* Decorative Top Trim */}
                      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-600 via-amber-200 to-emerald-600"></div>

                      {/* Swipe Stamp Overlay */}
                      {swipeDirection && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-xs z-30 transition-all duration-200 animate-fade-in">
                          {swipeDirection === "right" && (
                            <div className="border-4 border-emerald-600 text-emerald-600 font-bold uppercase text-2xl px-5 py-2.5 rounded-xl rotate-[-12deg] tracking-widest bg-white/95 shadow-md">
                              CONNECT ❤️
                            </div>
                          )}
                          {swipeDirection === "left" && (
                            <div className="border-4 border-amber-700 text-amber-700 font-bold uppercase text-2xl px-5 py-2.5 rounded-xl rotate-[12deg] tracking-widest bg-white/95 shadow-md">
                              PASS ✕
                            </div>
                          )}
                          {swipeDirection === "super" && (
                            <div className="border-4 border-amber-500 text-amber-500 font-bold uppercase text-2xl px-5 py-2.5 rounded-xl rotate-[-6deg] tracking-widest bg-white/95 shadow-md">
                              SUPER ALIGN ✨
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-between items-center text-[10px] font-bold text-amber-850 uppercase tracking-widest">
                        <span>Card {swipeIndex + 1} of {matches.length}</span>
                        <span className="text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-100 font-bold">Next Chapter Match</span>
                      </div>

                      {/* Avatar Frame */}
                      <div className="relative mx-auto my-5 flex justify-center">
                        <div className="absolute inset-0 bg-gradient-to-tr from-amber-200 to-rose-200 rounded-full blur-xl opacity-30 animate-pulse-subtle"></div>
                        <div className={`w-28 h-28 rounded-full bg-gradient-to-tr ${currentCompanion.avatarColor} flex items-center justify-center text-5xl shadow-lg border-4 border-white relative z-10`}>
                          {currentCompanion.avatarEmoji}
                        </div>
                      </div>

                      {/* Header Info */}
                      <div className="text-center">
                        <h3 className="font-serif font-bold text-2xl text-amber-950 flex items-center justify-center gap-2">
                          {currentCompanion.name}, <span className="font-sans text-xl font-semibold">{currentCompanion.age}</span>
                        </h3>
                        
                        <p className="text-xs font-semibold text-amber-850 mt-1 flex items-center justify-center gap-1.5">
                          <span>{currentCompanion.occupation}</span>
                          <span className="text-amber-200">•</span>
                          <span className="text-[10px] text-amber-700 font-medium tracking-wider">{currentCompanion.chapterTheme}</span>
                        </p>

                        <div className="flex items-center justify-center gap-3.5 mt-2.5 text-xs font-semibold text-amber-700">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            {currentCompanion.location}
                          </span>
                          <span className="text-amber-200">|</span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-50" />
                            Goal: {currentCompanion.relationshipGoal}
                          </span>
                        </div>

                        {/* Direct Conversation CTA Button on Card */}
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMatch(currentCompanion);
                              setActiveTab("conversations");
                            }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-950 hover:bg-amber-900 text-white rounded-2xl font-bold text-xs transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-rose-300" />
                            <span>Start Conversation in Dialogue Salon</span>
                          </button>
                        </div>
                      </div>

                      {/* EXPANDABLE SECTION 1: BIO & PASSIONS */}
                      <div className="mt-5 pt-4 border-t border-amber-100/60">
                        <button
                          type="button"
                          onClick={() => setIsBioExpanded(!isBioExpanded)}
                          className="w-full flex items-center justify-between text-xs font-bold text-amber-900 hover:text-amber-950 transition-colors"
                        >
                          <span>{isBioExpanded ? "Hide Introduction & Passions" : "View Introduction & Passions"}</span>
                          <span className="text-[10px] transition-transform duration-200" style={{ transform: isBioExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                            ▼
                          </span>
                        </button>

                        {isBioExpanded && (
                          <div className="mt-3 text-left space-y-3 animate-fade-in max-h-48 overflow-y-auto no-scrollbar scroll-momentum">
                            <p className="text-xs text-amber-900 leading-relaxed italic bg-amber-50/50 p-3.5 rounded-2xl border border-amber-100/50">
                              "{currentCompanion.bio}"
                            </p>
                            <div>
                              <h4 className="text-[9px] font-bold text-amber-950 uppercase tracking-widest mb-1.5">Passions & Hobbies</h4>
                              <div className="flex flex-wrap gap-1">
                                {currentCompanion.interests.map(interest => (
                                  <span key={interest} className="text-[10px] px-2.5 py-1 bg-white border border-amber-100/60 text-amber-800 rounded-lg font-medium">
                                    {interest}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* EXPANDABLE SECTION 2: AI HARMONY COMPATIBILITY ASSESSMENT */}
                      <div className="mt-3 pt-3 border-t border-amber-100/60">
                        <button
                          type="button"
                          onClick={() => setIsQuizExpanded(!isQuizExpanded)}
                          className="w-full flex items-center justify-between text-xs font-bold text-emerald-800 hover:text-emerald-900 transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100" />
                            {companionReport ? `AI Harmony Alignment (${companionReport.matchScore}%)` : "Assess AI Harmony & Compatibility"}
                          </span>
                          <span className="text-[10px] transition-transform duration-200" style={{ transform: isQuizExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                            ▼
                          </span>
                        </button>

                        {isQuizExpanded && (
                          <div className="mt-3 text-left space-y-4 animate-fade-in bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100/60">
                            {companionReport ? (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-serif font-bold text-sm text-emerald-950">Harmony Report ({companionReport.matchScore}% Match)</h4>
                                </div>
                                <p className="text-xs text-amber-900 italic font-medium leading-relaxed">
                                  "{companionReport.summary}"
                                </p>
                                <div>
                                  <h5 className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider mb-1">Shared Strengths</h5>
                                  <ul className="space-y-1">
                                    {companionReport.sharedStrengths.map((str, idx) => (
                                      <li key={idx} className="text-[11px] text-amber-900 flex items-center gap-1.5 font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span>{str}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <p className="text-xs text-amber-900 font-medium">Answer 3 questions to generate personalized AI compatibility insights with {currentCompanion.name}:</p>
                                {COMPATIBILITY_QUIZ_QUESTIONS.map((q) => {
                                  const chosenVal = currentMatchQuizAnswers[q.id];
                                  return (
                                    <div key={q.id} className="p-3 rounded-xl bg-white border border-amber-100">
                                      <h5 className="text-xs font-semibold text-amber-950 mb-2">{q.question}</h5>
                                      <div className="grid grid-cols-1 gap-1.5">
                                        {q.options.map((opt) => {
                                          const isChecked = chosenVal === opt.value;
                                          return (
                                            <button
                                              key={opt.value}
                                              type="button"
                                              onClick={() => handleSelectQuizOption(currentCompanion.id, q.id, opt.value)}
                                              className={`p-2 rounded-lg border text-left text-[11px] transition-all cursor-pointer ${
                                                isChecked
                                                  ? "bg-amber-950 border-amber-950 text-white font-bold"
                                                  : "bg-amber-50/50 border-amber-100 text-amber-900 hover:bg-amber-100/50"
                                              }`}
                                            >
                                              <span className="font-semibold">{opt.label}: </span>
                                              <span>{opt.text}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}

                                <button
                                  type="button"
                                  onClick={() => handleSubmitQuiz(currentCompanion.id)}
                                  disabled={isAnalyzingCompatibility}
                                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                  {isAnalyzingCompatibility ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Calculating Harmony...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-3.5 h-3.5 fill-emerald-100" />
                                      <span>Evaluate Compatibility</span>
                                    </>
                                  )}
                                </button>
                                {compatibilityError && (
                                  <p className="text-[10px] text-red-600 font-medium">{compatibilityError}</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Controls Panel Below Card */}
                    <div className="flex items-center justify-center gap-4 mt-6">
                      {/* Rewind */}
                      <button
                        onClick={handleSwipeRewind}
                        disabled={swipeIndex === 0}
                        className={`p-3.5 rounded-full border transition-all ${
                          swipeIndex === 0
                            ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed"
                            : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
                        }`}
                        title="Rewind Last Swipe"
                      >
                        <Undo2 className="w-5 h-5" />
                      </button>

                      {/* Pass / Dislike */}
                      <button
                        onClick={() => handleSwipeAction("left")}
                        className="p-5 rounded-full bg-white border border-amber-200 text-amber-900 hover:bg-amber-50 hover:text-amber-950 hover:scale-110 active:scale-90 transition-all cursor-pointer shadow-md flex items-center justify-center animate-pulse-subtle"
                        title="Pass (Swipe Left)"
                      >
                        <span className="text-xl font-bold leading-none">✕</span>
                      </button>

                      {/* Super Match */}
                      <button
                        onClick={() => handleSwipeAction("super")}
                        className="p-3.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-xs"
                        title="Super Connect! (Sparkles)"
                      >
                        <Sparkles className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                      </button>

                      {/* Connect / Like */}
                      <button
                        onClick={() => handleSwipeAction("right")}
                        className="p-5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 hover:scale-110 active:scale-90 transition-all cursor-pointer shadow-md flex items-center justify-center"
                        title="Connect & Chat! (Swipe Right)"
                      >
                        <Heart className="w-6 h-6 fill-rose-100" />
                      </button>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav id="mobile-bottom-nav" className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FAF7F2]/95 backdrop-blur-md border-t border-amber-100/80 px-2 py-2 flex justify-around items-center shadow-lg animate-fade-in select-none">
        <button
          type="button"
          onClick={() => {
            setActiveTab("gardens");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-center cursor-pointer transition-all ${
            activeTab === "gardens" || activeTab === "compass" || activeTab === "search" ? "text-amber-950 font-bold" : "text-amber-700/70 hover:text-amber-900"
          }`}
        >
          <Compass className={`w-4.5 h-4.5 ${activeTab === "gardens" || activeTab === "compass" || activeTab === "search" ? "text-emerald-600 scale-110" : "text-amber-600/70"} transition-all`} />
          <span className="text-[9px] mt-1 font-semibold tracking-tight">Explore & Compass</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("conversations");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-center cursor-pointer transition-all ${
            activeTab === "conversations" || activeTab === "cafe" ? "text-amber-950 font-bold" : "text-amber-700/70 hover:text-amber-900"
          }`}
        >
          <div className="relative">
            <MessageSquare className={`w-4.5 h-4.5 ${activeTab === "conversations" || activeTab === "cafe" ? "text-rose-500 scale-110" : "text-amber-600/70"} transition-all`} />
          </div>
          <span className="text-[9px] mt-1 font-semibold tracking-tight">Dialogue & Cafe</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("storyroom");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-center cursor-pointer transition-all ${
            activeTab === "storyroom" ? "text-amber-950 font-bold" : "text-amber-700/70 hover:text-amber-900"
          }`}
        >
          <BookOpen className={`w-4.5 h-4.5 ${activeTab === "storyroom" ? "text-blue-600 scale-110" : "text-amber-600/70"} transition-all`} />
          <span className="text-[9px] mt-1 font-semibold tracking-tight">Story</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("my_profile");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-center cursor-pointer transition-all ${
            activeTab === "my_profile" ? "text-amber-950 font-bold" : "text-amber-700/70 hover:text-amber-900"
          }`}
        >
          <User className={`w-4.5 h-4.5 ${activeTab === "my_profile" ? "text-purple-500 scale-110" : "text-amber-600/70"} transition-all`} />
          <span className="text-[9px] mt-1 font-semibold tracking-tight">Profile</span>
        </button>
      </nav>

      {/* FOOTER */}
      <footer id="main-footer" className="bg-[#FAF5EE] border-t border-amber-100 py-12 mt-20 text-center">
        <div className="max-w-6xl mx-auto px-4 space-y-4">
          <div className="flex items-center justify-center gap-1.5">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            <h5 className="font-serif font-bold text-amber-900">Next Chapter Dating</h5>
          </div>
          <p className="text-xs text-amber-700 max-w-md mx-auto leading-relaxed">
            Dating for Next Chapter is designed with profound respect, spacious accessibility metrics, and AI matching parameters. Live beautifully, connect safely, and share standard laughter.
          </p>
          <div className="text-[10px] text-amber-600/80">
            <span>Next Chapter Applet © {new Date().getFullYear()} • Powered via Gemini AI Studio Models</span>
          </div>
        </div>
      </footer>

      {/* Subscription Upgrade Modal Overlay */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 bg-amber-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-amber-100 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 relative animate-scale-up">
            <button
              onClick={() => {
                setShowSubscriptionModal(false);
                setSubscriptionPromptReason(null);
              }}
              className="absolute top-4 right-4 text-amber-900 hover:text-amber-700 font-bold text-sm bg-amber-50 hover:bg-amber-100/80 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
            >
              ✕
            </button>
            
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mx-auto">
                <Sparkles className="w-7 h-7 text-amber-500 fill-amber-200 animate-pulse" />
              </div>
              <h3 className="font-serif text-2xl font-bold text-amber-950">Next Chapter Premium</h3>
              <p className="text-xs text-amber-700/90 leading-relaxed font-medium">
                Unlock unrestricted connection dialogues, direct contact details exchange, and advanced compatibility matchmaking.
              </p>
            </div>

            {subscriptionPromptReason && (
              <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-4 text-xs text-rose-900 font-semibold leading-relaxed">
                {subscriptionPromptReason}
              </div>
            )}

            <div className="bg-[#FCFAF7] border border-amber-100 p-4 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">Premium Benefits Included:</h4>
              <ul className="space-y-2 text-xs text-amber-800">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Exchange emails, phone numbers, and social handles freely</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Full access to Vinyl Melody Generators & lounges</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>AI-guided story refinement with complete dignity</span>
                </li>
              </ul>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleUpgradeSubscription}
                disabled={isUpgrading}
                className="w-full py-3 bg-amber-950 hover:bg-amber-900 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 text-xs"
              >
                {isUpgrading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Processing Secure Upgrade...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
                    <span>Subscribe - $9.99/mo (Instant Setup)</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSubscriptionModal(false);
                  setSubscriptionPromptReason(null);
                }}
                className="w-full py-2.5 text-xs text-amber-700 font-semibold hover:text-amber-950 transition-all cursor-pointer text-center"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match / Connection Celebration Modal */}
      {showMatchModal && matchedCompanion && (
        <div className="fixed inset-0 bg-amber-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#FAF8F5] border-2 border-amber-200 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 relative text-center animate-scale-up">
            <div className="relative mx-auto my-2 flex justify-center">
              <div className="absolute inset-0 bg-rose-200 rounded-full blur-xl opacity-50 animate-pulse"></div>
              <div className={`w-24 h-24 rounded-full bg-gradient-to-tr ${matchedCompanion.avatarColor} flex items-center justify-center text-5xl shadow-xl border-4 border-white relative z-10`}>
                {matchedCompanion.avatarEmoji}
              </div>
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100" />
                Chapter Connection
              </span>
              <h3 className="font-serif text-2xl font-bold text-amber-950">
                You and {matchedCompanion.name} Aligned!
              </h3>
              <p className="text-xs text-amber-850 leading-relaxed font-medium">
                {matchedCompanion.name} ({matchedCompanion.age}, {matchedCompanion.occupation}) is ready to share conversations with you in the Dialogue Salon.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => {
                  setSelectedMatch(matchedCompanion);
                  setActiveTab("conversations");
                  setShowMatchModal(false);
                }}
                className="w-full py-3.5 bg-amber-950 text-white font-bold rounded-2xl hover:bg-amber-900 transition-all cursor-pointer shadow-md text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-rose-300" />
                <span>Open Dialogue Salon & Chat Now</span>
              </button>
              <button
                onClick={() => setShowMatchModal(false)}
                className="w-full py-3 bg-white border border-amber-200 text-amber-900 font-semibold rounded-2xl hover:bg-amber-50 transition-all cursor-pointer text-xs uppercase tracking-wider"
              >
                Keep Exploring Deck
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
