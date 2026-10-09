import { useState, type ReactNode } from 'react';
import {
  AppBar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CalculateIcon from '@mui/icons-material/Calculate';
import MenuIcon from '@mui/icons-material/Menu';
import PublicIcon from '@mui/icons-material/Public';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { PageHeader, WidgetShell } from '@credithub/ui';
import { useAuth } from '@credithub/auth-context';
import { lazyProvider } from '../mf';
import { ProviderBoundary } from './provider-boundary';
import { ProviderMount } from './provider-mount';
import { RequireAuth } from './require-auth';

const DRAWER_WIDTH = 240;

/**
 * Внутренний маршрут SPA (`path`) либо ссылка на другой сервис (`href`).
 * Размеченное объединение, чтобы навигацию нельзя было отправить по пустому
 * пути: у элемента всегда есть ровно одно из двух.
 */
type NavItem = { kind: 'route' | 'link'; to: string; label: string; icon: ReactNode };

const NAV_ITEMS: NavItem[] = [
  { kind: 'route', to: '/', label: 'Обзор', icon: <DashboardIcon /> },
  { kind: 'route', to: '/credits', label: 'Кредиты', icon: <CreditCardIcon /> },
  { kind: 'route', to: '/calculator', label: 'Калькулятор', icon: <CalculateIcon /> },
  // Публичный SSR-раздел живёт отдельным сервисом (схема ingress в PROJECT.md):
  // у него свой документ и своя тема, поэтому ведём обычной ссылкой, а не
  // SPA-переходом - shell не владеет этим маршрутом.
  { kind: 'link', to: '/programs', label: 'Программы', icon: <PublicIcon /> },
];

// Loaded lazily: the remoteEntry.js of mfe-credits is only fetched when the
// route that renders this is actually visited (see the CDP check for "/").
const ProviderMfeCredits = lazyProvider('mfe-credits', 'CreditsApp');

function Dashboard() {
  return (
    <section data-testid="dashboard">
      <PageHeader title="Обзор" subtitle="Сводка по портфелю" />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
        <WidgetShell title="Клиентов">
          <Typography variant="h3" component="p">
            128
          </Typography>
        </WidgetShell>
        <WidgetShell title="Активных кредитов">
          <Typography variant="h3" component="p">
            317
          </Typography>
        </WidgetShell>
        <WidgetShell title="Просроченных">
          <Typography variant="h3" component="p">
            4
          </Typography>
        </WidgetShell>
      </Box>
    </section>
  );
}

function NotFound() {
  return (
    <section data-testid="not-found">
      <PageHeader title="Страница не найдена" subtitle="Проверьте адрес" />
    </section>
  );
}

/**
 * Пункт меню. Вынесен отдельным компонентом, потому что внутри JSX-колбэка
 * TypeScript не сужает размеченное объединение `NavItem` и `navigate` получает
 * `string | undefined`.
 */
function NavEntry({
  item,
  currentPath,
  onNavigate,
}: {
  item: NavItem;
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  if (item.kind === 'link') {
    // Раздел на другом сервисе: полная навигация нужна, чтобы документ отдал
    // SSR-сервер, а не клиентский роутер shell.
    return (
      <ListItemButton component="a" href={item.to}>
        <ListItemIcon>{item.icon}</ListItemIcon>
        <ListItemText primary={item.label} />
      </ListItemButton>
    );
  }

  return (
    <ListItemButton
      selected={currentPath === item.to}
      onClick={() => onNavigate(item.to)}
    >
      <ListItemIcon>{item.icon}</ListItemIcon>
      <ListItemText primary={item.label} />
    </ListItemButton>
  );
}

export function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  // Состояние входа берём из общего контекста: тот же токен позже получит remote.
  const auth = useAuth();

  const drawerContent = (
    <List component="nav" aria-label="Разделы">
      {NAV_ITEMS.map((item) => (
        <NavEntry
          key={item.to}
          item={item}
          currentPath={location.pathname}
          onNavigate={(path) => {
            navigate(path);
            setDrawerOpen(false);
          }}
        />
      ))}
    </List>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            aria-label="Открыть меню"
            sx={{ mr: 2, display: { md: 'none' } }}
            onClick={() => setDrawerOpen(true)}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h3" component="h1">
            CreditHub
          </Typography>
          {/* Правая часть шапки: кто вошёл и кнопка входа/выхода. */}
          <Box sx={{ flexGrow: 1 }} />
          {auth.isLoading ? null : auth.isAuthenticated ? (
            <>
              <Typography variant="caption" sx={{ mr: 2 }}>
                {auth.username ?? ''}
                {auth.roles.length > 0 ? ` (${auth.roles.join(', ')})` : ''}
              </Typography>
              <Button color="inherit" onClick={auth.logout}>
                Выйти
              </Button>
            </>
          ) : (
            <Button color="inherit" onClick={auth.login}>
              Войти
            </Button>
          )}
          {auth.error ? (
            <Typography
              variant="caption"
              role="alert"
              sx={{ ml: 2, maxWidth: 320 }}
            >
              {auth.error}
            </Typography>
          ) : null}
        </Toolbar>
      </AppBar>

      {/* Permanent on md+, a temporary overlay below that. */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
        open
      >
        <Toolbar />
        {drawerContent}
      </Drawer>
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/credits"
            element={
              // Данные этой страницы приходят из защищённого BFF, поэтому без
              // сессии уводим на Keycloak и возвращаемся сюда же после входа.
              <RequireAuth>
                <ProviderBoundary name="mfe-credits">
                  <ProviderMfeCredits />
                </ProviderBoundary>
              </RequireAuth>
            }
          />
          {/* mfe-calculator is Angular, so it exposes mount(element) instead of
              a React component and is mounted by ProviderMount, not lazily by
              React. */}
          <Route
            path="/calculator"
            element={
              <section data-testid="calculator-route">
                <PageHeader title="Калькулятор" subtitle="Кредитный калькулятор" />
                <ProviderMount alias="mfe-calculator" />
              </section>
            }
          />
          {/* /programs здесь намеренно НЕТ: публичный SSR-раздел обслуживает
              отдельный сервис mfe-programs (см. tools/dev-ingress.mjs), и shell
              ведёт на него обычной ссылкой из меню. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Box>
    </Box>
  );
}

export default App;
