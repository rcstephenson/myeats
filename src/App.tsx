import { lazy, Suspense } from 'react';
import { BrowserRouter, Outlet, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { TabBar } from './components/ui';
import UpdatePrompt from './components/UpdatePrompt';
import { useApplyTheme } from './hooks/useApplyTheme';
import Diary from './routes/Diary';

// Everything except the Diary (the landing route and the critical logging path) is split out so
// first paint ships less JS. Recharts only loads with Weight and Trends.
const Foods = lazy(() => import('./routes/Foods'));
const FoodEditor = lazy(() => import('./routes/FoodEditor'));
const MealEditor = lazy(() => import('./routes/MealEditor'));
const RecipeEditor = lazy(() => import('./routes/RecipeEditor'));
const Weight = lazy(() => import('./routes/Weight'));
const Trends = lazy(() => import('./routes/Trends'));
const Settings = lazy(() => import('./routes/Settings'));
const Goals = lazy(() => import('./routes/Goals'));
const Categories = lazy(() => import('./routes/Categories'));

// Dev-only routes: the dynamic imports are dead-code-eliminated from production builds.
const UiDemo = import.meta.env.DEV ? lazy(() => import('./dev/UiDemo')) : null;
const SeedDemo = import.meta.env.DEV ? lazy(() => import('./dev/SeedDemo')) : null;

function Layout() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  // The tab bar is hidden while the Add overlay (?add=<categoryId>) is open on the Diary.
  const adding = pathname === '/' && params.has('add');
  return (
    <div className="pt-safe mx-auto min-h-[100dvh] max-w-app">
      <main className="pb-28">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
      {adding ? null : <TabBar />}
    </div>
  );
}

export default function App() {
  useApplyTheme();
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Diary />} />
          <Route path="/day/:date" element={<Diary />} />
          <Route path="/foods" element={<Foods />} />
          <Route path="/foods/new" element={<FoodEditor />} />
          <Route path="/foods/:id" element={<FoodEditor />} />
          <Route path="/meals/new" element={<MealEditor />} />
          <Route path="/meals/:id" element={<MealEditor />} />
          <Route path="/recipes/new" element={<RecipeEditor />} />
          <Route path="/recipes/:id" element={<RecipeEditor />} />
          <Route path="/weight" element={<Weight />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/goals" element={<Goals />} />
          <Route path="/settings/categories" element={<Categories />} />
          {UiDemo ? <Route path="/dev/ui" element={<UiDemo />} /> : null}
          {SeedDemo ? <Route path="/dev/seed" element={<SeedDemo />} /> : null}
        </Route>
      </Routes>
      <UpdatePrompt />
    </BrowserRouter>
  );
}
