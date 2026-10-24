import { Route } from "react-router-dom";

import { BusinessesPage } from "@/features/landing/BusinessesPage";
import { FeaturesPage } from "@/features/landing/FeaturesPage";
import { LandingPage } from "@/features/landing/LandingPage";
import { PublicLayout } from "@/routes/PublicLayout";
import { BUSINESSES_PAGE, FEATURES_PAGE, HOME_PAGE } from "@/seo/pages";

/** Rutas indexables: las usan la app (cliente) y el pre-render (servidor), para que no diverjan. */
export const publicRoutes = (
  <Route element={<PublicLayout />}>
    <Route path={HOME_PAGE.path} element={<LandingPage />} />
    <Route path={FEATURES_PAGE.path} element={<FeaturesPage />} />
    <Route path={BUSINESSES_PAGE.path} element={<BusinessesPage />} />
  </Route>
);
