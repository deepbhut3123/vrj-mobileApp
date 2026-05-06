import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AppLanguage = "en" | "gu";

type TranslationKey =
  | "tabs_home"
  | "tabs_shop"
  | "tabs_route"
  | "tabs_settings"
  | "common_cancel"
  | "common_save"
  | "common_close"
  | "common_error"
  | "common_validation"
  | "auth_missing_details"
  | "auth_login_failed"
  | "auth_login_title"
  | "auth_login_subtitle"
  | "auth_email"
  | "auth_password"
  | "auth_forgot_password"
  | "auth_sign_in"
  | "auth_no_account"
  | "auth_register"
  | "register_title"
  | "register_subtitle"
  | "register_full_name"
  | "register_role"
  | "register_other"
  | "register_admin"
  | "register_success_title"
  | "register_success_message"
  | "register_failed"
  | "forgot_title"
  | "forgot_subtitle"
  | "forgot_send_link"
  | "forgot_missing_email_title"
  | "forgot_missing_email_message"
  | "forgot_failed"
  | "forgot_success_title"
  | "forgot_success_message"
  | "forgot_back_signin"
  | "home_title"
  | "home_subtitle"
  | "home_name"
  | "home_email"
  | "home_open_profile"
  | "home_admin_subtitle"
  | "home_user_subtitle"
  | "home_open_shop"
  | "home_open_route"
  | "home_open_settings"
  | "home_welcome_title"
  | "home_welcome_message"
  | "home_stats_admin_title"
  | "home_stats_user_title"
  | "home_stats_shops"
  | "home_stats_routes"
  | "home_stats_users"
  | "home_stats_my_shops"
  | "profile_title"
  | "profile_subtitle"
  | "profile_role"
  | "profile_admin"
  | "profile_user"
  | "profile_logout"
  | "routes_title"
  | "routes_subtitle"
  | "routes_add"
  | "routes_edit"
  | "routes_delete"
  | "routes_no_data"
  | "routes_no_access"
  | "routes_admin_only"
  | "routes_login_required"
  | "routes_signin_first"
  | "routes_modal_add"
  | "routes_modal_edit"
  | "routes_col_no"
  | "routes_col_name"
  | "routes_col_created"
  | "routes_col_actions"
  | "routes_validation_name"
  | "routes_not_found"
  | "shops_title"
  | "shops_admin_subtitle"
  | "shops_user_subtitle"
  | "shops_add"
  | "shops_no_data"
  | "shops_route"
  | "shops_created"
  | "shops_modal_title"
  | "shops_select_route"
  | "shops_shop_name"
  | "shops_shop_address"
  | "shops_mobile_number"
  | "shops_upload_image"
  | "shops_change_image"
  | "shops_image_url_fallback"
  | "shops_validation_fields"
  | "shops_no_routes"
  | "shops_permission_title"
  | "shops_permission_message"
  | "shops_picker_unavailable_title"
  | "shops_picker_unavailable_message"
  | "settings_title"
  | "settings_profile_tab"
  | "settings_language_tab"
  | "settings_logout_tab"
  | "settings_language_title"
  | "settings_choose_language"
  | "settings_logout_title"
  | "settings_logout_message"
  | "settings_open_profile";

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  en: {
    tabs_home: "Home",
    tabs_shop: "Shop",
    tabs_route: "Route",
    tabs_settings: "Settings",
    common_cancel: "Cancel",
    common_save: "Save",
    common_close: "Close",
    common_error: "Error",
    common_validation: "Validation",
    auth_missing_details: "Please enter both email and password.",
    auth_login_failed: "Login failed",
    auth_login_title: "Welcome Back",
    auth_login_subtitle: "Sign in to continue",
    auth_email: "Email address",
    auth_password: "Password",
    auth_forgot_password: "Forgot password?",
    auth_sign_in: "Sign In",
    auth_no_account: "Don't have an account?",
    auth_register: "Register",
    register_title: "Create Account",
    register_subtitle: "Create your account",
    register_full_name: "Full name",
    register_role: "Select Role",
    register_other: "Other",
    register_admin: "Admin",
    register_success_title: "Account created",
    register_success_message: "Registration successful.",
    register_failed: "Registration failed",
    forgot_title: "Forgot Password",
    forgot_subtitle: "We will send reset instructions to your email.",
    forgot_send_link: "Send Link",
    forgot_missing_email_title: "Missing email",
    forgot_missing_email_message: "Please enter your email address.",
    forgot_failed: "Request failed",
    forgot_success_title: "Check your email",
    forgot_success_message: "Password reset instructions sent.",
    forgot_back_signin: "Back to Sign In",
    home_title: "Login Successful",
    home_subtitle: "Welcome to home.",
    home_name: "Name",
    home_email: "Email",
    home_open_profile: "Open Profile",
    home_admin_subtitle: "Manage your operations quickly.",
    home_user_subtitle: "Track your daily shop activity.",
    home_open_shop: "Open Shops",
    home_open_route: "Open Route Module",
    home_open_settings: "Open Settings",
    home_welcome_title: "Welcome Back",
    home_welcome_message: "Hi {{name}}, your workspace is ready for today.",
    home_stats_admin_title: "Dashboard Overview",
    home_stats_user_title: "Your Shop Summary",
    home_stats_shops: "Shops",
    home_stats_routes: "Routes",
    home_stats_users: "Users",
    home_stats_my_shops: "My Shops",
    profile_title: "Profile",
    profile_subtitle: "Manage your account",
    profile_role: "Role",
    profile_admin: "Admin",
    profile_user: "User",
    profile_logout: "Logout",
    routes_title: "Routes",
    routes_subtitle: "Create and manage delivery routes.",
    routes_add: "Add",
    routes_edit: "Edit",
    routes_delete: "Delete",
    routes_no_data: "No routes found.",
    routes_no_access: "No access",
    routes_admin_only: "This module is available only for admin.",
    routes_login_required: "Login required",
    routes_signin_first: "Please sign in first.",
    routes_modal_add: "Add Route",
    routes_modal_edit: "Edit Route",
    routes_col_no: "No.",
    routes_col_name: "Route Name",
    routes_col_created: "Created",
    routes_col_actions: "Actions",
    routes_validation_name: "Route name is required.",
    routes_not_found: "Route details not found.",
    shops_title: "Shops",
    shops_admin_subtitle: "Manage all shop records in one place.",
    shops_user_subtitle: "View and update your assigned shops.",
    shops_add: "Add Shop",
    shops_no_data: "No shops found.",
    shops_route: "Route",
    shops_created: "Created",
    shops_modal_title: "Add Shop",
    shops_select_route: "Select route",
    shops_shop_name: "Shop name",
    shops_shop_address: "Shop address",
    shops_mobile_number: "Mobile number",
    shops_upload_image: "Take Photo",
    shops_change_image: "Retake Photo",
    shops_image_url_fallback: "Or paste image URL (fallback)",
    shops_validation_fields: "Route, shop name, shop address and mobile number are required.",
    shops_no_routes: "No routes available.",
    shops_permission_title: "Permission required",
    shops_permission_message: "Please allow camera access to capture a shop image.",
    shops_picker_unavailable_title: "Camera unavailable",
    shops_picker_unavailable_message: "Please rebuild the app once, then reopen it.",
    settings_title: "Settings",
    settings_profile_tab: "Profile",
    settings_language_tab: "Language",
    settings_logout_tab: "Logout",
    settings_language_title: "Language",
    settings_choose_language: "Choose app language",
    settings_logout_title: "Logout",
    settings_logout_message: "Tap below to sign out from app.",
    settings_open_profile: "Open Full Profile",
  },
  gu: {
    tabs_home: "હોમ",
    tabs_shop: "દુકાન",
    tabs_route: "રૂટ",
    tabs_settings: "સેટિંગ્સ",
    common_cancel: "રદ કરો",
    common_save: "સેવ કરો",
    common_close: "બંધ કરો",
    common_error: "ભૂલ",
    common_validation: "ચકાસણી",
    auth_missing_details: "કૃપા કરીને ઇમેલ અને પાસવર્ડ બંને દાખલ કરો.",
    auth_login_failed: "લૉગિન નિષ્ફળ",
    auth_login_title: "ફરીથી સ્વાગત છે",
    auth_login_subtitle: "આગળ વધવા માટે સાઇન ઇન કરો",
    auth_email: "ઇમેલ સરનામું",
    auth_password: "પાસવર્ડ",
    auth_forgot_password: "પાસવર્ડ ભૂલી ગયા?",
    auth_sign_in: "સાઇન ઇન",
    auth_no_account: "એકાઉન્ટ નથી?",
    auth_register: "રજિસ્ટર",
    register_title: "એકાઉન્ટ બનાવો",
    register_subtitle: "તમારું એકાઉન્ટ બનાવો",
    register_full_name: "પૂર્ણ નામ",
    register_role: "ભૂમિકા પસંદ કરો",
    register_other: "અન્ય",
    register_admin: "એડમિન",
    register_success_title: "એકાઉન્ટ બન્યું",
    register_success_message: "રજિસ્ટ્રેશન સફળ થયું.",
    register_failed: "રજિસ્ટ્રેશન નિષ્ફળ",
    forgot_title: "પાસવર્ડ ભૂલી ગયા",
    forgot_subtitle: "અમે તમારી ઇમેલ પર રીસેટ સૂચનાઓ મોકલીશું.",
    forgot_send_link: "લિંક મોકલો",
    forgot_missing_email_title: "ઇમેલ ખૂટે છે",
    forgot_missing_email_message: "કૃપા કરીને તમારી ઇમેલ દાખલ કરો.",
    forgot_failed: "વિનંતી નિષ્ફળ",
    forgot_success_title: "તમારી ઇમેલ ચેક કરો",
    forgot_success_message: "પાસવર્ડ રીસેટ સૂચનાઓ મોકલવામાં આવી.",
    forgot_back_signin: "પાછા સાઇન ઇન પર",
    home_title: "લૉગિન સફળ",
    home_subtitle: "હોમમાં સ્વાગત છે.",
    home_name: "નામ",
    home_email: "ઇમેલ",
    home_open_profile: "પ્રોફાઇલ ખોલો",
    home_admin_subtitle: "તમારા ઓપરેશન્સ ઝડપથી મેનેજ કરો.",
    home_user_subtitle: "તમારી દૈનિક દુકાન પ્રવૃત્તિ ટ્રેક કરો.",
    home_open_shop: "દુકાનો ખોલો",
    home_open_route: "રૂટ મોડ્યુલ ખોલો",
    home_open_settings: "સેટિંગ્સ ખોલો",
    home_welcome_title: "ફરીથી સ્વાગત",
    home_welcome_message: "હાય {{name}}, આજે માટે તમારું વર્કસ્પેસ તૈયાર છે.",
    home_stats_admin_title: "ડૅશબોર્ડ અવલોકન",
    home_stats_user_title: "તમારી દુકાન સારાંશ",
    home_stats_shops: "દુકાનો",
    home_stats_routes: "રૂટ્સ",
    home_stats_users: "યુઝર્સ",
    home_stats_my_shops: "મારી દુકાનો",
    profile_title: "પ્રોફાઇલ",
    profile_subtitle: "તમારું એકાઉન્ટ મેનેજ કરો",
    profile_role: "ભૂમિકા",
    profile_admin: "એડમિન",
    profile_user: "યુઝર",
    profile_logout: "લૉગઆઉટ",
    routes_title: "રૂટ્સ",
    routes_subtitle: "ડિલિવરી રૂટ્સ બનાવો અને મેનેજ કરો.",
    routes_add: "ઉમેરો",
    routes_edit: "એડિટ",
    routes_delete: "ડિલીટ",
    routes_no_data: "કોઈ રૂટ મળ્યા નથી.",
    routes_no_access: "ઍક્સેસ નથી",
    routes_admin_only: "આ મોડ્યુલ ફક્ત એડમિન માટે છે.",
    routes_login_required: "લૉગિન જરૂરી",
    routes_signin_first: "કૃપા કરીને પહેલા સાઇન ઇન કરો.",
    routes_modal_add: "રૂટ ઉમેરો",
    routes_modal_edit: "રૂટ એડિટ કરો",
    routes_col_no: "ક્રમ",
    routes_col_name: "રૂટ નામ",
    routes_col_created: "બનાવ્યું",
    routes_col_actions: "ક્રિયાઓ",
    routes_validation_name: "રૂટ નામ જરૂરી છે.",
    routes_not_found: "રૂટ વિગતો મળી નથી.",
    shops_title: "દુકાનો",
    shops_admin_subtitle: "બધા દુકાન રેકોર્ડ્સ એક જગ્યાએ મેનેજ કરો.",
    shops_user_subtitle: "તમને સોંપાયેલ દુકાનો જુઓ અને અપડેટ કરો.",
    shops_add: "દુકાન ઉમેરો",
    shops_no_data: "કોઈ દુકાન મળી નથી.",
    shops_route: "રૂટ",
    shops_created: "બનાવ્યું",
    shops_modal_title: "દુકાન ઉમેરો",
    shops_select_route: "રૂટ પસંદ કરો",
    shops_shop_name: "દુકાન નામ",
    shops_shop_address: "દુકાન સરનામું",
    shops_mobile_number: "મોબાઇલ નંબર",
    shops_upload_image: "ફોટો લો",
    shops_change_image: "ફરી ફોટો લો",
    shops_image_url_fallback: "અથવા ઇમેજ URL પેસ્ટ કરો",
    shops_validation_fields: "રૂટ, દુકાન નામ, દુકાન સરનામું અને મોબાઇલ નંબર જરૂરી છે.",
    shops_no_routes: "કોઈ રૂટ ઉપલબ્ધ નથી.",
    shops_permission_title: "પરવાનગી જરૂરી",
    shops_permission_message: "દુકાનની ઇમેજ લેવા કેમેરા પરવાનગી આપો.",
    shops_picker_unavailable_title: "કેમેરા ઉપલબ્ધ નથી",
    shops_picker_unavailable_message: "એપ ફરી બિલ્ડ કરીને ફરી ખોલો.",
    settings_title: "સેટિંગ્સ",
    settings_profile_tab: "પ્રોફાઇલ",
    settings_language_tab: "ભાષા",
    settings_logout_tab: "લૉગઆઉટ",
    settings_language_title: "ભાષા",
    settings_choose_language: "એપની ભાષા પસંદ કરો",
    settings_logout_title: "લૉગઆઉટ",
    settings_logout_message: "એપમાંથી બહાર નીકળવા નીચે ટેપ કરો.",
    settings_open_profile: "પૂર્ણ પ્રોફાઇલ ખોલો",
  },
};

type I18nContextType = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextType | null>(null);
const LANGUAGE_STORAGE_KEY = "app_language_v1";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("en");

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved === "en" || saved === "gu") {
          setLanguageState(saved);
        }
      } catch {
        // Keep default language on read failure.
      }
    };

    loadLanguage();
  }, []);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  }, []);

  const value = useMemo<I18nContextType>(
    () => ({
      language,
      setLanguage,
      t: (key, vars) => {
        const raw = translations[language]?.[key] ?? translations.en[key] ?? key;
        if (!vars) {
          return raw;
        }
        return raw.replace(/\{\{(\w+)\}\}/g, (_, token: string) =>
          vars[token] !== undefined ? String(vars[token]) : `{{${token}}}`,
        );
      },
    }),
    [language, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
