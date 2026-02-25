'use client';
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var react_1 = require("react");
var link_1 = require("next/link");
var navigation_1 = require("next/navigation");
var authService_1 = require("@/modules/auth/services/authService");
var i18n_1 = require("@/shared/i18n");
var useUiPreferences_1 = require("@/shared/hooks/useUiPreferences");
function LoginPage() {
    var _this = this;
    var _a = react_1.useState(''), email = _a[0], setEmail = _a[1];
    var _b = react_1.useState(''), password = _b[0], setPassword = _b[1];
    var _c = react_1.useState(false), loading = _c[0], setLoading = _c[1];
    var _d = react_1.useState(''), error = _d[0], setError = _d[1];
    var router = navigation_1.useRouter();
    var searchParams = navigation_1.useSearchParams();
    var redirectTo = searchParams.get('redirect');
    var _e = useUiPreferences_1.useUiPreferences(null), language = _e.language, setLanguage = _e.setLanguage;
    var handleSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var user, err_1, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    setError('');
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, 7, 8]);
                    // Validate inputs
                    if (!email.trim()) {
                        setError('Введите email');
                        setLoading(false);
                        return [2 /*return*/];
                    }
                    if (!password) {
                        setError('Введите пароль');
                        setLoading(false);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, authService_1.login({ email: email, password: password })];
                case 2:
                    user = _a.sent();
                    if (!user) return [3 /*break*/, 4];
                    // Successfully logged in
                    console.log('Login successful for user:', user.email);
                    // Wait for auth persistence to save cookies
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 3:
                    // Wait for auth persistence to save cookies
                    _a.sent();
                    console.log('Redirecting to dashboard');
                    router.push(redirectTo || '/dashboard');
                    return [3 /*break*/, 5];
                case 4:
                    setError('Неверные учётные данные');
                    _a.label = 5;
                case 5: return [3 /*break*/, 8];
                case 6:
                    err_1 = _a.sent();
                    console.error('Login error:', err_1);
                    console.error('Error details:', {
                        message: err_1.message,
                        code: err_1.code,
                        fullError: err_1
                    });
                    errorMessage = err_1.message || 'Ошибка входа. Проверьте email и пароль.';
                    // Handle Firebase auth errors
                    if (err_1.code === 'auth/user-not-found') {
                        setError('Пользователь не найден. Пожалуйста, зарегистрируйтесь.');
                    }
                    else if (err_1.code === 'auth/wrong-password') {
                        setError('Неверный пароль.');
                    }
                    else if (err_1.code === 'auth/invalid-email') {
                        setError('Неверный формат email.');
                    }
                    else if (err_1.code === 'auth/user-disabled') {
                        setError('Учётная запись отключена.');
                    }
                    else if (err_1.code === 'permission-denied') {
                        setError('Нет доступа к базе данных. Проверьте правила безопасности Firebase.');
                    }
                    else {
                        setError(errorMessage);
                    }
                    return [3 /*break*/, 8];
                case 7:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    return (React.createElement("div", { className: "min-h-screen bg-linear-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4" },
        React.createElement("div", { className: "w-full max-w-md" },
            React.createElement("div", { className: "text-center mb-8" },
                React.createElement("h1", { className: "text-3xl font-bold text-white mb-2" }, "\uD83C\uDFE2 Domera"),
                React.createElement("p", { className: "text-gray-400" }, i18n_1.t(language, 'loginTitle'))),
            React.createElement("div", { className: "bg-slate-800 rounded-lg p-8 border border-slate-700" },
                React.createElement("div", { className: "mb-4 grid grid-cols-3 gap-2", "aria-label": "Language" }, [
                    { code: 'lv', label: 'LV' },
                    { code: 'en', label: 'ENG' },
                    { code: 'ru', label: 'RU' },
                ].map(function (item) { return (React.createElement("button", { key: item.code, type: "button", onClick: function () { return setLanguage(item.code); }, className: [
                        'rounded-lg px-3 py-2 text-sm font-semibold border transition',
                        language === item.code
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600',
                    ].join(' ') }, item.label)); })),
                error && (React.createElement("div", { className: "bg-red-500 bg-opacity-20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6" }, error)),
                React.createElement("form", { onSubmit: handleSubmit, className: "space-y-6" },
                    React.createElement("div", null,
                        React.createElement("label", { className: "block text-sm font-medium text-gray-300 mb-2" }, i18n_1.t(language, 'emailLabel')),
                        React.createElement("input", { type: "email", value: email, onChange: function (e) { return setEmail(e.target.value); }, placeholder: "example@mail.com", className: "w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition", required: true })),
                    React.createElement("div", null,
                        React.createElement("label", { className: "block text-sm font-medium text-gray-300 mb-2" }, i18n_1.t(language, 'passwordLabel')),
                        React.createElement("input", { type: "password", value: password, onChange: function (e) { return setPassword(e.target.value); }, placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", className: "w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition", required: true })),
                    React.createElement("div", { className: "text-right" },
                        React.createElement(link_1["default"], { href: "/reset-password", className: "text-sm text-blue-400 hover:text-blue-300 transition" }, i18n_1.t(language, 'forgotPassword'))),
                    React.createElement("button", { type: "submit", disabled: loading, className: "w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-600 transition" }, loading ? i18n_1.t(language, 'loginInProgress') : i18n_1.t(language, 'loginButton'))),
                React.createElement("p", { className: "text-center text-gray-400 mt-6" },
                    i18n_1.t(language, 'noAccount'),
                    ' ',
                    React.createElement(link_1["default"], { href: "/register", className: "text-blue-400 hover:text-blue-300 transition" }, i18n_1.t(language, 'register')))),
            React.createElement("div", { className: "text-center mt-6" },
                React.createElement(link_1["default"], { href: "/", className: "text-gray-400 hover:text-gray-300 transition" },
                    "\u2190 ",
                    i18n_1.t(language, 'backHome'))))));
}
exports["default"] = LoginPage;
