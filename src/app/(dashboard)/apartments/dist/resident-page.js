"use client";
"use strict";
exports.__esModule = true;
var useAuth_1 = require("@/shared/hooks/useAuth");
var useTranslations_1 = require("@/shared/i18n/useTranslations");
var link_1 = require("next/link");
var react_1 = require("react");
var apartmentsService_1 = require("@/modules/apartments/services/apartmentsService");
var buildingsService_1 = require("@/modules/buildings/services/buildingsService");
function ResidentApartmentsPage() {
    var _a;
    var _b = useAuth_1.useAuth(), user = _b.user, loading = _b.loading, isResident = _b.isResident;
    var _c = react_1.useState(null), apartment = _c[0], setApartment = _c[1];
    var _d = react_1.useState(null), building = _d[0], setBuilding = _d[1];
    var t = useTranslations_1.useTranslations('apartment');
    react_1.useEffect(function () {
        if (isResident && (user === null || user === void 0 ? void 0 : user.apartmentId)) {
            apartmentsService_1.getApartment(user.apartmentId).then(setApartment);
        }
    }, [user, isResident]);
    react_1.useEffect(function () {
        if (apartment === null || apartment === void 0 ? void 0 : apartment.buildingId) {
            buildingsService_1.getBuilding(apartment.buildingId).then(setBuilding);
        }
    }, [apartment]);
    if (loading)
        return React.createElement("div", { className: "text-white" }, t('loading'));
    if (!user)
        return React.createElement("div", { className: "text-white" }, t('loginRequired'));
    if (!isResident)
        return React.createElement("div", { className: "text-white" }, t('noAccess'));
    return (React.createElement("div", { className: "min-h-screen bg-linear-to-br from-slate-900 to-slate-800" },
        React.createElement("header", { className: "bg-slate-800 border-b border-slate-700" },
            React.createElement("div", { className: "max-w-7xl mx-auto px-4 py-4 flex items-center justify-between" },
                React.createElement(link_1["default"], { href: "/dashboard", className: "text-gray-400 hover:text-white" },
                    "\u2190 ",
                    t('backButton')),
                React.createElement("h1", { className: "text-2xl font-bold text-white" }, t('myApartmentTitle')))),
        React.createElement("main", { className: "max-w-2xl mx-auto px-4 py-8" },
            React.createElement("div", { className: "bg-slate-800 border border-slate-700 rounded-lg p-8" },
                React.createElement("h2", { className: "text-xl font-bold text-white mb-4" },
                    t('apartmentLabel'),
                    " ",
                    (apartment === null || apartment === void 0 ? void 0 : apartment.number) || '—'),
                React.createElement("div", { className: "mb-2 text-gray-400" },
                    t('buildingLabel'),
                    ": ",
                    (building === null || building === void 0 ? void 0 : building.address) || '—'),
                React.createElement("div", { className: "mb-2 text-gray-400" },
                    t('managementCompanyLabel'),
                    ": ",
                    ((_a = building === null || building === void 0 ? void 0 : building.managedBy) === null || _a === void 0 ? void 0 : _a.companyName) || '—')))));
}
exports["default"] = ResidentApartmentsPage;
