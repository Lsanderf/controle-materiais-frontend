import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MaterialsPage from './pages/MaterialsPage';
import MaterialFormPage from './pages/MaterialFormPage';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeFormPage from './pages/EmployeeFormPage';
import ContractsPage from './pages/ContractsPage';
import ContractFormPage from './pages/ContractFormPage';
import MovementsPage from './pages/MovementsPage';
import MovementFormPage from './pages/MovementFormPage';
import HistoryPage from './pages/HistoryPage';
import UsersPage from './pages/UsersPage';
import UserFormPage from './pages/UserFormPage';
import MorePage from './pages/MorePage';
import NotFoundPage from './pages/NotFoundPage';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/materiais" element={<MaterialsPage />} />
          <Route path="/funcionarios" element={<EmployeesPage />} />
          <Route path="/contratos" element={<ContractsPage />} />
          <Route path="/movimentacoes" element={<MovementsPage />} />
          <Route path="/movimentacoes/historico" element={<HistoryPage />} />
          <Route path="/mais" element={<MorePage />} />

          <Route element={<ProtectedRoute roles={['ADMIN', 'OPERADOR']} />}>
            <Route
              path="/movimentacoes/entrada"
              element={<MovementFormPage type="ENTRADA" />}
            />
            <Route
              path="/movimentacoes/retirada"
              element={<MovementFormPage type="RETIRADA" />}
            />
            <Route
              path="/movimentacoes/devolucao"
              element={<MovementFormPage type="DEVOLUCAO" />}
            />
          </Route>

          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/materiais/novo" element={<MaterialFormPage />} />
            <Route
              path="/materiais/:id/editar"
              element={<MaterialFormPage />}
            />
            <Route path="/funcionarios/novo" element={<EmployeeFormPage />} />
            <Route
              path="/funcionarios/:id/editar"
              element={<EmployeeFormPage />}
            />
            <Route path="/contratos/novo" element={<ContractFormPage />} />
            <Route
              path="/contratos/:id/editar"
              element={<ContractFormPage />}
            />
            <Route path="/usuarios" element={<UsersPage />} />
            <Route path="/usuarios/novo" element={<UserFormPage />} />
            <Route path="/usuarios/:id/editar" element={<UserFormPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
