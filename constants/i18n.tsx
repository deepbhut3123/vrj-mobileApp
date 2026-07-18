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
  | "tabs_bill"
  | "tabs_retailer_bills"
  | "tabs_dealer_bills"
  | "tabs_attendance"
  | "tabs_route"
  | "tabs_settings"
  | "dealer_bills_title"
  | "dealer_bills_subtitle"
  | "dealer_bills_add"
  | "dealer_bills_empty"
  | "dealer_bills_unknown_dealer"
  | "dealer_bills_unknown_city"
  | "dealer_bills_katta"
  | "dealer_bills_created_by"
  | "dealer_bills_unknown_user"
  | "dealer_bills_total"
  | "dealer_bills_new_title"
  | "dealer_bills_close"
  | "dealer_bills_field_dealer"
  | "dealer_bills_select_dealer"
  | "dealer_bills_field_date"
  | "dealer_bills_field_katta"
  | "dealer_bills_field_products"
  | "dealer_bills_rate"
  | "dealer_bills_bill_total"
  | "dealer_bills_create"
  | "dealer_bills_choose_dealer"
  | "dealer_bills_validation_message"
  | "dealer_bills_validation_dealer"
  | "dealer_bills_validation_date"
  | "dealer_bills_validation_katta"
  | "dealer_bills_validation_products"
  | "dealer_bills_load_error"
  | "dealer_bills_create_error"
  | "dealer_bills_alert_title"
  | "dealer_bills_detail_qty"
  | "dealer_bills_detail_mrp"
  | "dealer_bills_detail_amount"
  | "attendance_title"
  | "attendance_subtitle"
  | "attendance_today_in"
  | "attendance_today_out"
  | "attendance_today_break_in"
  | "attendance_today_break_out"
  | "attendance_in_button"
  | "attendance_out_button"
  | "attendance_break_in_button"
  | "attendance_break_out_button"
  | "attendance_daywise_title"
  | "attendance_daywise_subtitle"
  | "attendance_empty_title"
  | "attendance_empty_message"
  | "attendance_access_title"
  | "attendance_access_message"
  | "attendance_in_time"
  | "attendance_out_time"
  | "attendance_break_in_time"
  | "attendance_break_out_time"
  | "attendance_status_present"
  | "attendance_filter_title"
  | "attendance_filter_month"
  | "attendance_filter_year"
  | "attendance_empty_filtered"
  | "attendance_alert_title"
  | "attendance_checkin_success"
  | "attendance_checkout_success"
  | "attendance_breakin_success"
  | "attendance_breakout_success"
  | "attendance_location_permission"
  | "attendance_location_services"
  | "attendance_location_unavailable"
  | "attendance_location_status_title"
  | "attendance_location_checking"
  | "attendance_location_allowed"
  | "attendance_location_outside"
  | "attendance_location_not_configured"
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
  | "auth_login_identifier"
  | "auth_password"
  | "auth_forgot_password"
  | "auth_sign_in"
  | "auth_verification_title"
  | "auth_verification_subtitle"
  | "auth_verification_code"
  | "auth_verification_missing_code"
  | "auth_verify_code"
  | "auth_back_to_login"
  | "auth_verification_heading"
  | "auth_verification_helper"
  | "auth_verification_notice"
  | "auth_change_credentials"
  | "auth_no_account"
  | "auth_register"
  | "register_title"
  | "register_subtitle"
  | "register_full_name"
  | "register_role"
  | "register_other"
  | "register_success_title"
  | "register_success_message"
  | "register_failed"
  | "forgot_title"
  | "forgot_subtitle"
  | "forgot_send_link"
  | "forgot_enter_otp"
  | "forgot_otp_placeholder"
  | "forgot_verify_otp"
  | "forgot_missing_otp"
  | "forgot_otp_sent_message"
  | "forgot_otp_verified_title"
  | "forgot_otp_verified_message"
  | "forgot_missing_reset_token"
  | "forgot_missing_email_title"
  | "forgot_missing_email_message"
  | "forgot_failed"
  | "forgot_success_title"
  | "forgot_success_message"
  | "forgot_back_signin"
  | "reset_title"
  | "reset_subtitle"
  | "reset_new_password"
  | "reset_confirm_password"
  | "reset_submit"
  | "reset_missing_fields"
  | "reset_password_mismatch"
  | "reset_failed"
  | "reset_success_title"
  | "reset_success_message"
  | "home_title"
  | "home_subtitle"
  | "home_name"
  | "home_email"
  | "home_open_profile"
  | "home_user_subtitle"
  | "home_open_shop"
  | "home_open_route"
  | "home_open_settings"
  | "home_welcome_title"
  | "home_welcome_message"
  | "home_stats_user_title"
  | "home_stats_my_shops"
  | "home_stats_staff_title"
  | "home_stats_attendance_days"
  | "home_stats_delivery_title"
  | "home_stats_pending_delivery"
  | "home_stats_delivery_complete"
  | "home_stats_dealer_title"
  | "home_stats_month_sale"
  | "home_stats_pending_payment"
  | "home_stats_dealer_empty"
  | "profile_title"
  | "profile_subtitle"
  | "profile_role"
  | "profile_user"
  | "profile_logout"
  | "routes_title"
  | "routes_subtitle"
  | "routes_add"
  | "routes_edit"
  | "routes_delete"
  | "routes_no_data"
  | "routes_login_required"
  | "routes_signin_first"
  | "routes_modal_add"
  | "routes_modal_edit"
  | "routes_col_no"
  | "routes_col_name"
  | "routes_col_name_gujarati"
  | "routes_city_name"
  | "routes_city_name_gujarati"
  | "routes_col_created"
  | "routes_col_actions"
  | "routes_validation_name"
  | "routes_validation_fields"
  | "routes_not_found"
  | "shops_title"
  | "shops_user_subtitle"
  | "shops_add"
  | "shops_no_data"
  | "shops_route"
  | "shops_modal_title"
  | "shops_select_route"
  | "shops_shop_name"
  | "shops_shop_name_gujarati"
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
  | "bills_title"
  | "bills_subtitle"
  | "bills_add"
  | "bills_no_data"
  | "bills_status"
  | "bills_total"
  | "bills_items"
  | "bills_modal_title"
  | "bills_select_route"
  | "bills_select_shop"
  | "bills_products_title"
  | "bills_quantity"
  | "bills_create"
  | "bills_validation"
  | "bills_total_sticky"
  | "bills_route_picker_title"
  | "bills_shop_picker_title"
  | "bills_ordered"
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
    tabs_bill: "Bills",
    tabs_retailer_bills: "Retailer Bills",
    tabs_dealer_bills: "Dealer Bills",
    tabs_attendance: "Attendance",
    tabs_route: "Route",
    tabs_settings: "Settings",
    dealer_bills_title: "Dealer Bills",
    dealer_bills_subtitle: "Review dealer bills, katta count, and item totals.",
    dealer_bills_add: "Add Bill",
    dealer_bills_empty: "No dealer bills found.",
    dealer_bills_unknown_dealer: "Unknown dealer",
    dealer_bills_unknown_city: "Unknown city",
    dealer_bills_katta: "Katta",
    dealer_bills_created_by: "Created by {{name}}",
    dealer_bills_unknown_user: "Unknown user",
    dealer_bills_total: "Total",
    dealer_bills_new_title: "New Dealer Bill",
    dealer_bills_close: "Close",
    dealer_bills_field_dealer: "Dealer",
    dealer_bills_select_dealer: "Select dealer",
    dealer_bills_field_date: "Bill Date",
    dealer_bills_field_katta: "Katta Count",
    dealer_bills_field_products: "Products",
    dealer_bills_rate: "Rate",
    dealer_bills_bill_total: "Bill Total",
    dealer_bills_create: "Create Bill",
    dealer_bills_choose_dealer: "Choose Dealer",
    dealer_bills_validation_message: "Select dealer, date, katta count above 0, and at least one product quantity.",
    dealer_bills_validation_dealer: "Please select a dealer.",
    dealer_bills_validation_date: "Please enter the bill date.",
    dealer_bills_validation_katta: "Please enter katta count above 0.",
    dealer_bills_validation_products: "Please enter quantity for at least one product.",
    dealer_bills_load_error: "Unable to load dealer bill form",
    dealer_bills_create_error: "Unable to create dealer bill",
    dealer_bills_alert_title: "Dealer Bill",
    dealer_bills_detail_qty: "Qty",
    dealer_bills_detail_mrp: "MRP",
    dealer_bills_detail_amount: "Amount",
    attendance_title: "Attendance",
    attendance_subtitle: "Mark your check-in and check-out, then review your day-wise attendance below.",
    attendance_today_in: "Today In",
    attendance_today_out: "Today Out",
    attendance_today_break_in: "Break In",
    attendance_today_break_out: "Break Out",
    attendance_in_button: "In",
    attendance_out_button: "Out",
    attendance_break_in_button: "Break On",
    attendance_break_out_button: "Break Off",
    attendance_daywise_title: "Day-wise Attendance",
    attendance_daywise_subtitle: "Pull down to refresh after marking attendance.",
    attendance_empty_title: "No attendance records yet.",
    attendance_empty_message: "Use the buttons above to create your first attendance entry.",
    attendance_access_title: "Attendance Access",
    attendance_access_message: "This tab is available for staff users only. Current role: {{role}}.",
    attendance_in_time: "In Time",
    attendance_out_time: "Out Time",
    attendance_break_in_time: "Break In Time",
    attendance_break_out_time: "Break Out Time",
    attendance_status_present: "Present",
    attendance_filter_title: "Month Filter",
    attendance_filter_month: "Month",
    attendance_filter_year: "Year",
    attendance_empty_filtered: "No attendance records for this month.",
    attendance_alert_title: "Attendance",
    attendance_checkin_success: "Check-in marked successfully.",
    attendance_checkout_success: "Check-out marked successfully.",
    attendance_breakin_success: "Break-in marked successfully.",
    attendance_breakout_success: "Break-out marked successfully.",
    attendance_location_permission: "Location permission is required to mark attendance.",
    attendance_location_services: "Please enable location services to mark attendance.",
    attendance_location_unavailable: "Current location could not be detected. Attendance action was not sent.",
    attendance_location_status_title: "Location Status",
    attendance_location_checking: "Checking your current location for attendance access.",
    attendance_location_allowed: "You are inside the attendance area. Distance: {{distance}} of {{radius}} allowed.",
    attendance_location_outside: "Attendance is disabled here. You are {{distance}} away and must be within {{radius}}.",
    attendance_location_not_configured: "Attendance location is not configured yet. Set office latitude and longitude in the app environment.",
    common_cancel: "Cancel",
    common_save: "Save",
    common_close: "Close",
    common_error: "Error",
    common_validation: "Validation",
    auth_missing_details: "Please enter email/mobile number and password.",
    auth_login_failed: "Login failed",
    auth_login_title: "Welcome Back",
    auth_login_subtitle: "Sign in to continue",
    auth_email: "Email address",
    auth_login_identifier: "Email or mobile number",
    auth_password: "Password",
    auth_forgot_password: "Forgot password?",
    auth_sign_in: "Sign In",
    auth_verification_title: "Verification required",
    auth_verification_subtitle:
      "Enter the 6-digit code from admin Google Authenticator.",
    auth_verification_code: "Google authentication code",
    auth_verification_missing_code: "Please enter the authentication code.",
    auth_verify_code: "Verify Code",
    auth_back_to_login: "Back to login",
    auth_verification_heading: "Enter Verification Code",
    auth_verification_helper:
      "Ask admin for the current Google Authenticator code and enter that 6-digit code here.",
    auth_verification_notice:
      "Your email and password are already checked. Only the authenticator code is needed now.",
    auth_change_credentials: "Use different login details",
    auth_no_account: "Don't have an account?",
    auth_register: "Register",
    register_title: "Create Account",
    register_subtitle: "Create your account",
    register_full_name: "Full name",
    register_role: "Select Role",
    register_other: "Other",
    register_success_title: "Account created",
    register_success_message: "Registration successful.",
    register_failed: "Registration failed",
    forgot_title: "Forgot Password",
    forgot_subtitle: "We will send a password reset OTP to your email.",
    forgot_send_link: "Send OTP",
    forgot_enter_otp: "Enter OTP",
    forgot_otp_placeholder: "6-digit OTP",
    forgot_verify_otp: "Verify OTP",
    forgot_missing_otp: "Please enter the OTP sent to your email.",
    forgot_otp_sent_message: "Password reset OTP sent to your email.",
    forgot_otp_verified_title: "OTP verified",
    forgot_otp_verified_message: "OTP verified successfully.",
    forgot_missing_reset_token: "Reset token missing from OTP verification response.",
    forgot_missing_email_title: "Missing email",
    forgot_missing_email_message: "Please enter your email address.",
    forgot_failed: "Request failed",
    forgot_success_title: "Check your email",
    forgot_success_message: "Password reset OTP sent to your email.",
    forgot_back_signin: "Back to Sign In",
    reset_title: "Reset Password",
    reset_subtitle: "Choose your new password.",
    reset_new_password: "New password",
    reset_confirm_password: "Confirm password",
    reset_submit: "Update Password",
    reset_missing_fields: "Please enter both password fields.",
    reset_password_mismatch: "Passwords do not match.",
    reset_failed: "Reset failed",
    reset_success_title: "Password updated",
    reset_success_message: "Your password has been reset successfully.",
    home_title: "Login Successful",
    home_subtitle: "Welcome to home.",
    home_name: "Name",
    home_email: "Email",
    home_open_profile: "Open Profile",
    home_user_subtitle: "Track your daily shop activity.",
    home_open_shop: "Open Shops",
    home_open_route: "Open Route Module",
    home_open_settings: "Open Settings",
    home_welcome_title: "Welcome Back",
    home_welcome_message: "Hi {{name}}, your workspace is ready for today.",
    home_stats_user_title: "Your Shop Summary",
    home_stats_my_shops: "My Shops",
    home_stats_staff_title: "Your Attendance Summary",
    home_stats_attendance_days: "Attendance Days",
    home_stats_delivery_title: "Your Delivery Summary",
    home_stats_pending_delivery: "Pending for Delivery",
    home_stats_delivery_complete: "Delivery Complete",
    home_stats_dealer_title: "Your Sales Summary",
    home_stats_month_sale: "Current Month Sale",
    home_stats_pending_payment: "Pending Payment",
    home_stats_dealer_empty: "No dealer bills for the selected month.",
    profile_title: "Profile",
    profile_subtitle: "Manage your account",
    profile_role: "Role",
    profile_user: "User",
    profile_logout: "Logout",
    routes_title: "Routes",
    routes_subtitle: "Create and manage delivery routes.",
    routes_add: "Add",
    routes_edit: "Edit",
    routes_delete: "Delete",
    routes_no_data: "No routes found.",
    routes_login_required: "Login required",
    routes_signin_first: "Please sign in first.",
    routes_modal_add: "Add Route",
    routes_modal_edit: "Edit Route",
    routes_col_no: "No.",
    routes_col_name: "Route Name",
    routes_col_name_gujarati: "Route Name (Gujarati)",
    routes_city_name: "City Name",
    routes_city_name_gujarati: "City Name (Gujarati)",
    routes_col_created: "Created",
    routes_col_actions: "Actions",
    routes_validation_name: "Route name is required.",
    routes_validation_fields: "Route name and city name are required.",
    routes_not_found: "Route details not found.",
    shops_title: "Shops",
    shops_user_subtitle: "View and update your assigned shops.",
    shops_add: "Add Shop",
    shops_no_data: "No shops found.",
    shops_route: "Route",
    shops_modal_title: "Add Shop",
    shops_select_route: "Select route",
    shops_shop_name: "Shop name",
    shops_shop_name_gujarati: "Shop name (Gujarati)",
    shops_shop_address: "Shop address",
    shops_mobile_number: "Mobile number",
    shops_upload_image: "Take Photo",
    shops_change_image: "Retake Photo",
    shops_image_url_fallback: "Or paste image URL (fallback)",
    shops_validation_fields:
      "Route, shop name, shop address and mobile number are required.",
    shops_no_routes: "No routes available.",
    shops_permission_title: "Permission required",
    shops_permission_message:
      "Please allow camera access to capture a shop image.",
    shops_picker_unavailable_title: "Camera unavailable",
    shops_picker_unavailable_message:
      "Please rebuild the app once, then reopen it.",
    bills_title: "My Bills",
    bills_subtitle:
      "Create bills from your route, shop, and admin product list.",
    bills_add: "Add Bill",
    bills_no_data: "No bills created yet.",
    bills_status: "Status",
    bills_total: "Total",
    bills_items: "Items",
    bills_modal_title: "Create Bill",
    bills_select_route: "Select route",
    bills_select_shop: "Select shop",
    bills_products_title: "Products",
    bills_quantity: "Quantity",
    bills_create: "Create Bill",
    bills_validation:
      "Please select route, shop, and at least one product quantity.",
    bills_total_sticky: "Bill Total",
    bills_route_picker_title: "Choose Route",
    bills_shop_picker_title: "Choose Shop",
    bills_ordered: "Ordered",
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
    tabs_bill: "બિલ",
    tabs_retailer_bills: "રિટેલર બિલ",
    tabs_dealer_bills: "ડીલર બિલ",
    tabs_attendance: "હાજરી",
    tabs_route: "રૂટ",
    tabs_settings: "સેટિંગ્સ",
    dealer_bills_title: "ડીલર બિલ",
    dealer_bills_subtitle: "ડીલર બિલ, કટ્ટા ગણતરી અને આઇટમ કુલ જુઓ.",
    dealer_bills_add: "બિલ ઉમેરો",
    dealer_bills_empty: "કોઈ ડીલર બિલ મળ્યા નથી.",
    dealer_bills_unknown_dealer: "અજાણ્યો ડીલર",
    dealer_bills_unknown_city: "અજાણ્યું શહેર",
    dealer_bills_katta: "કટ્ટા",
    dealer_bills_created_by: "{{name}} દ્વારા બનાવ્યું",
    dealer_bills_unknown_user: "અજાણ્યો યુઝર",
    dealer_bills_total: "કુલ",
    dealer_bills_new_title: "નવું ડીલર બિલ",
    dealer_bills_close: "બંધ કરો",
    dealer_bills_field_dealer: "ડીલર",
    dealer_bills_select_dealer: "ડીલર પસંદ કરો",
    dealer_bills_field_date: "બિલ તારીખ",
    dealer_bills_field_katta: "કટ્ટા ગણતરી",
    dealer_bills_field_products: "પ્રોડક્ટ્સ",
    dealer_bills_rate: "દર",
    dealer_bills_bill_total: "બિલ કુલ",
    dealer_bills_create: "બિલ બનાવો",
    dealer_bills_choose_dealer: "ડીલર પસંદ કરો",
    dealer_bills_validation_message: "ડીલર, તારીખ, 0 કરતાં વધુ કટ્ટા ગણતરી અને ઓછામાં ઓછી એક પ્રોડક્ટ જથ્થો પસંદ કરો.",
    dealer_bills_validation_dealer: "કૃપા કરીને ડીલર પસંદ કરો.",
    dealer_bills_validation_date: "કૃપા કરીને બિલ તારીખ દાખલ કરો.",
    dealer_bills_validation_katta: "કૃપા કરીને 0 કરતાં વધુ કટ્ટા ગણતરી દાખલ કરો.",
    dealer_bills_validation_products: "કૃપા કરીને ઓછામાં ઓછી એક પ્રોડક્ટ માટે જથ્થો દાખલ કરો.",
    dealer_bills_load_error: "ડીલર બિલ ફોર્મ લોડ થઈ શક્યું નથી",
    dealer_bills_create_error: "ડીલર બિલ બનાવી શકાયું નથી",
    dealer_bills_alert_title: "ડીલર બિલ",
    dealer_bills_detail_qty: "જથ્થો",
    dealer_bills_detail_mrp: "એમઆરપી",
    dealer_bills_detail_amount: "રકમ",
    attendance_title: "હાજરી",
    attendance_subtitle: "ચેક-ઇન અને ચેક-આઉટ માર્ક કરો, પછી નીચે તમારી દૈનિક હાજરી જુઓ.",
    attendance_today_in: "આજનું ઇન",
    attendance_today_out: "આજનું આઉટ",
    attendance_today_break_in: "બ્રેક ઇન",
    attendance_today_break_out: "બ્રેક આઉટ",
    attendance_in_button: "ઇન",
    attendance_out_button: "આઉટ",
    attendance_break_in_button: "બ્રેક ઓન",
    attendance_break_out_button: "બ્રેક ઓફ",
    attendance_daywise_title: "દિવસવાર હાજરી",
    attendance_daywise_subtitle: "હાજરી માર્ક કર્યા પછી રિફ્રેશ કરવા માટે નીચે ખેંચો.",
    attendance_empty_title: "હજુ સુધી હાજરી રેકોર્ડ નથી.",
    attendance_empty_message: "તમારી પ્રથમ હાજરી એન્ટ્રી બનાવવા માટે ઉપરના બટન વાપરો.",
    attendance_access_title: "હાજરી પ્રવેશ",
    attendance_access_message: "આ ટેબ ફક્ત સ્ટાફ યુઝર્સ માટે ઉપલબ્ધ છે. હાલની ભૂમિકા: {{role}}.",
    attendance_in_time: "ઇન સમય",
    attendance_out_time: "આઉટ સમય",
    attendance_break_in_time: "બ્રેક ઇન સમય",
    attendance_break_out_time: "બ્રેક આઉટ સમય",
    attendance_status_present: "હાજર",
    attendance_filter_title: "મહિનો ફિલ્ટર",
    attendance_filter_month: "મહિનો",
    attendance_filter_year: "વર્ષ",
    attendance_empty_filtered: "આ મહિના માટે હાજરી રેકોર્ડ નથી.",
    attendance_alert_title: "હાજરી",
    attendance_checkin_success: "ચેક-ઇન સફળતાપૂર્વક માર્ક થયું.",
    attendance_checkout_success: "ચેક-આઉટ સફળતાપૂર્વક માર્ક થયું.",
    attendance_breakin_success: "બ્રેક-ઇન સફળતાપૂર્વક માર્ક થયું.",
    attendance_breakout_success: "બ્રેક-આઉટ સફળતાપૂર્વક માર્ક થયું.",
    attendance_location_permission: "હાજરી માર્ક કરવા માટે લોકેશન પરમિશન જરૂરી છે.",
    attendance_location_services: "હાજરી માર્ક કરવા માટે કૃપા કરીને લોકેશન સર્વિસ ચાલુ કરો.",
    attendance_location_unavailable: "હાલનું લોકેશન મળ્યું નથી. હાજરી ક્રિયા મોકલવામાં આવી નથી.",
    attendance_location_status_title: "લોકેશન સ્થિતિ",
    attendance_location_checking: "હાજરી માટે તમારું હાલનું લોકેશન ચકાસી રહ્યા છીએ.",
    attendance_location_allowed: "તમે હાજરી વિસ્તારની અંદર છો. અંતર: {{distance}}, મંજૂર મર્યાદા {{radius}}.",
    attendance_location_outside: "અહીં હાજરી બંધ છે. તમે {{distance}} દૂર છો અને {{radius}}ની અંદર હોવું જરૂરી છે.",
    attendance_location_not_configured: "હાજરી લોકેશન હજુ સેટ થયેલ નથી. એપ એન્વાયર્નમેન્ટમાં ઓફિસ latitude અને longitude સેટ કરો.",
    common_cancel: "રદ કરો",
    common_save: "સેવ કરો",
    common_close: "બંધ કરો",
    common_error: "ભૂલ",
    common_validation: "ચકાસણી",
    auth_missing_details: "કૃપા કરીને ઇમેલ/મોબાઇલ નંબર અને પાસવર્ડ દાખલ કરો.",
    auth_login_failed: "લૉગિન નિષ્ફળ",
    auth_login_title: "ફરીથી સ્વાગત છે",
    auth_login_subtitle: "આગળ વધવા માટે સાઇન ઇન કરો",
    auth_email: "ઇમેલ સરનામું",
    auth_login_identifier: "ઇમેલ અથવા મોબાઇલ નંબર",
    auth_password: "પાસવર્ડ",
    auth_forgot_password: "પાસવર્ડ ભૂલી ગયા?",
    auth_sign_in: "સાઇન ઇન",
    auth_verification_title: "ચકાસણી જરૂરી",
    auth_verification_subtitle:
      "Admin Google Authenticator માંથી 6 અંકનો કોડ દાખલ કરો.",
    auth_verification_code: "ગૂગલ ઓથેન્ટિકેશન કોડ",
    auth_verification_missing_code: "કૃપા કરીને ઓથેન્ટિકેશન કોડ દાખલ કરો.",
    auth_verify_code: "કોડ ચકાસો",
    auth_back_to_login: "લૉગિન પર પાછા જાઓ",
    auth_verification_heading: "ચકાસણી કોડ દાખલ કરો",
    auth_verification_helper:
      "Admin પાસેથી હાલનો Google Authenticator કોડ પૂછો અને તે 6 અંકનો કોડ અહીં દાખલ કરો.",
    auth_verification_notice:
      "તમારી ઇમેલ અને પાસવર્ડ પહેલાથી ચકાસાઈ ગયા છે. હવે માત્ર authenticator કોડ જરૂરી છે.",
    auth_change_credentials: "અલગ લૉગિન વિગતો વાપરો",
    auth_no_account: "એકાઉન્ટ નથી?",
    auth_register: "રજિસ્ટર",
    register_title: "એકાઉન્ટ બનાવો",
    register_subtitle: "તમારું એકાઉન્ટ બનાવો",
    register_full_name: "પૂર્ણ નામ",
    register_role: "ભૂમિકા પસંદ કરો",
    register_other: "અન્ય",
    register_success_title: "એકાઉન્ટ બન્યું",
    register_success_message: "રજિસ્ટ્રેશન સફળ થયું.",
    register_failed: "રજિસ્ટ્રેશન નિષ્ફળ",
    forgot_title: "પાસવર્ડ ભૂલી ગયા",
    forgot_subtitle: "અમે તમારી ઇમેલ પર પાસવર્ડ રીસેટ OTP મોકલીશું.",
    forgot_send_link: "OTP મોકલો",
    forgot_enter_otp: "OTP દાખલ કરો",
    forgot_otp_placeholder: "6 અંકનો OTP",
    forgot_verify_otp: "OTP ચકાસો",
    forgot_missing_otp: "કૃપા કરીને તમારી ઇમેલ પર આવેલ OTP દાખલ કરો.",
    forgot_otp_sent_message: "પાસવર્ડ રીસેટ OTP તમારી ઇમેલ પર મોકલાયો છે.",
    forgot_otp_verified_title: "OTP ચકાસાઈ ગયો",
    forgot_otp_verified_message: "OTP સફળતાપૂર્વક ચકાસાઈ ગયો.",
    forgot_missing_reset_token: "OTP ચકાસણી પછી રીસેટ ટોકન મળ્યો નથી.",
    forgot_missing_email_title: "ઇમેલ ખૂટે છે",
    forgot_missing_email_message: "કૃપા કરીને તમારી ઇમેલ દાખલ કરો.",
    forgot_failed: "વિનંતી નિષ્ફળ",
    forgot_success_title: "તમારી ઇમેલ ચેક કરો",
    forgot_success_message: "પાસવર્ડ રીસેટ OTP મોકલવામાં આવ્યો.",
    forgot_back_signin: "પાછા સાઇન ઇન પર",
    reset_title: "પાસવર્ડ રીસેટ કરો",
    reset_subtitle: "તમારો નવો પાસવર્ડ પસંદ કરો.",
    reset_new_password: "નવો પાસવર્ડ",
    reset_confirm_password: "પાસવર્ડની પુષ્ટિ કરો",
    reset_submit: "પાસવર્ડ અપડેટ કરો",
    reset_missing_fields: "કૃપા કરીને બંને પાસવર્ડ ફીલ્ડ भरो.",
    reset_password_mismatch: "પાસવર્ડ એકસરખા નથી.",
    reset_failed: "રીસેટ નિષ્ફળ",
    reset_success_title: "પાસવર્ડ અપડેટ થયો",
    reset_success_message: "તમારો પાસવર્ડ સફળતાપૂર્વક રીસેટ થયો.",
    home_title: "લૉગિન સફળ",
    home_subtitle: "હોમમાં સ્વાગત છે.",
    home_name: "નામ",
    home_email: "ઇમેલ",
    home_open_profile: "પ્રોફાઇલ ખોલો",
    home_user_subtitle: "તમારી દૈનિક દુકાન પ્રવૃત્તિ ટ્રેક કરો.",
    home_open_shop: "દુકાનો ખોલો",
    home_open_route: "રૂટ મોડ્યુલ ખોલો",
    home_open_settings: "સેટિંગ્સ ખોલો",
    home_welcome_title: "ફરીથી સ્વાગત",
    home_welcome_message: "હાય {{name}}, આજે માટે તમારું વર્કસ્પેસ તૈયાર છે.",
    home_stats_user_title: "તમારી દુકાન સારાંશ",
    home_stats_my_shops: "મારી દુકાનો",
    home_stats_staff_title: "તમારી હાજરી સારાંશ",
    home_stats_attendance_days: "હાજરી દિવસો",
    home_stats_delivery_title: "તમારો ડિલિવરી સારાંશ",
    home_stats_pending_delivery: "ડિલિવરી માટે બાકી",
    home_stats_delivery_complete: "ડિલિવરી પૂર્ણ",
    home_stats_dealer_title: "તમારો વેચાણ સારાંશ",
    home_stats_month_sale: "હાલના મહિનાનું વેચાણ",
    home_stats_pending_payment: "બાકી ચુકવણી",
    home_stats_dealer_empty: "પસંદ કરેલા મહિને કોઈ ડીલર બિલ નથી.",
    profile_title: "પ્રોફાઇલ",
    profile_subtitle: "તમારું એકાઉન્ટ મેનેજ કરો",
    profile_role: "ભૂમિકા",
    profile_user: "યુઝર",
    profile_logout: "લૉગઆઉટ",
    routes_title: "રૂટ્સ",
    routes_subtitle: "ડિલિવરી રૂટ્સ બનાવો અને મેનેજ કરો.",
    routes_add: "ઉમેરો",
    routes_edit: "એડિટ",
    routes_delete: "ડિલીટ",
    routes_no_data: "કોઈ રૂટ મળ્યા નથી.",
    routes_login_required: "લૉગિન જરૂરી",
    routes_signin_first: "કૃપા કરીને પહેલા સાઇન ઇન કરો.",
    routes_modal_add: "રૂટ ઉમેરો",
    routes_modal_edit: "રૂટ એડિટ કરો",
    routes_col_no: "ક્રમ",
    routes_col_name: "રૂટ નામ",
    routes_col_name_gujarati: "રૂટ નામ (ગુજરાતી)",
    routes_city_name: "શહેરનું નામ",
    routes_city_name_gujarati: "શહેરનું નામ (ગુજરાતી)",
    routes_col_created: "બનાવ્યું",
    routes_col_actions: "ક્રિયાઓ",
    routes_validation_name: "રૂટ નામ જરૂરી છે.",
    routes_validation_fields: "રૂટ નામ અને શહેરનું નામ જરૂરી છે.",
    routes_not_found: "રૂટ વિગતો મળી નથી.",
    shops_title: "દુકાનો",
    shops_user_subtitle: "તમને સોંપાયેલ દુકાનો જુઓ અને અપડેટ કરો.",
    shops_add: "દુકાન ઉમેરો",
    shops_no_data: "કોઈ દુકાન મળી નથી.",
    shops_route: "રૂટ",
    shops_modal_title: "દુકાન ઉમેરો",
    shops_select_route: "રૂટ પસંદ કરો",
    shops_shop_name: "દુકાન નામ",
    shops_shop_name_gujarati: "દુકાન નામ (ગુજરાતી)",
    shops_shop_address: "દુકાન સરનામું",
    shops_mobile_number: "મોબાઇલ નંબર",
    shops_upload_image: "ફોટો લો",
    shops_change_image: "ફરી ફોટો લો",
    shops_image_url_fallback: "અથવા ઇમેજ URL પેસ્ટ કરો",
    shops_validation_fields:
      "રૂટ, દુકાન નામ, દુકાન સરનામું અને મોબાઇલ નંબર જરૂરી છે.",
    shops_no_routes: "કોઈ રૂટ ઉપલબ્ધ નથી.",
    shops_permission_title: "પરવાનગી જરૂરી",
    shops_permission_message: "દુકાનની ઇમેજ લેવા કેમેરા પરવાનગી આપો.",
    shops_picker_unavailable_title: "કેમેરા ઉપલબ્ધ નથી",
    shops_picker_unavailable_message: "એપ ફરી બિલ્ડ કરીને ફરી ખોલો.",
    bills_title: "મારા બિલ",
    bills_subtitle: "તમારા રૂટ, દુકાન અને એડમિન પ્રોડક્ટ સૂચિમાંથી બિલ બનાવો.",
    bills_add: "બિલ ઉમેરો",
    bills_no_data: "હજુ કોઈ બિલ બનાવ્યું નથી.",
    bills_status: "સ્થિતિ",
    bills_total: "કુલ",
    bills_items: "આઇટમ્સ",
    bills_modal_title: "બિલ બનાવો",
    bills_select_route: "રૂટ પસંદ કરો",
    bills_select_shop: "દુકાન પસંદ કરો",
    bills_products_title: "પ્રોડક્ટ્સ",
    bills_quantity: "જથ્થો",
    bills_create: "બિલ બનાવો",
    bills_validation:
      "કૃપા કરીને રૂટ, દુકાન અને ઓછામાં ઓછી એક પ્રોડક્ટ જથ્થો પસંદ કરો.",
    bills_total_sticky: "બિલ કુલ",
    bills_route_picker_title: "રૂટ પસંદ કરો",
    bills_shop_picker_title: "દુકાન પસંદ કરો",
    bills_ordered: "ઓર્ડર કરેલું",
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
        const raw =
          translations[language]?.[key] ?? translations.en[key] ?? key;
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
