import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MaterialsPage from './pages/MaterialsPage';
import MaterialFormPage from './pages/MaterialFormPage';
import EncarregadosPage from './pages/EncarregadosPage';
import ContractsPage from './pages/ContractsPage';
import ContractFormPage from './pages/ContractFormPage';
import MovementsPage from './pages/MovementsPage';
import MovementFormPage from './pages/MovementFormPage';
import HistoryPage from './pages/HistoryPage';
import NotasFiscaisPage from './pages/NotasFiscaisPage';
import NotaFiscalFormPage from './pages/NotaFiscalFormPage';
import NotaFiscalDetailPage from './pages/NotaFiscalDetailPage';
import UsersPage from './pages/UsersPage';
import UserFormPage from './pages/UserFormPage';
import MorePage from './pages/MorePage';
import NotFoundPage from './pages/NotFoundPage';
import RequisitionsPage from './pages/RequisitionsPage';
import RequisitionFormPage from './pages/RequisitionFormPage';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/requisicoes" element={<RequisitionsPage />} />
          <Route path="/mais" element={<MorePage />} />

          <Route element={<ProtectedRoute roles={['ADMIN', 'OPERADOR']} />}>
            <Route path="/materiais" element={<MaterialsPage />} />
            <Route path="/movimentacoes" element={<MovementsPage />} />
            <Route path="/movimentacoes/historico" element={<HistoryPage />} />
            <Route path="/notas-fiscais" element={<NotasFiscaisPage />} />
            <Route path="/notas-fiscais/:id" element={<NotaFiscalDetailPage />} />
            <Route path="/materiais/novo" element={<MaterialFormPage />} />
            <Route
              path="/movimentacoes/retirada"
              element={<MovementFormPage key="RETIRADA" type="RETIRADA" />}
            />
            <Route
              path="/movimentacoes/devolucao"
              element={<MovementFormPage key="DEVOLUCAO" type="DEVOLUCAO" />}
            />
            <Route path="/notas-fiscais/nova" element={<NotaFiscalFormPage />} />
            <Route
              path="/notas-fiscais/:id/editar"
              element={<NotaFiscalFormPage />}
            />
          </Route>

          <Route element={<ProtectedRoute roles={['ADMIN', 'OPERADOR', 'GERENTE']} />}>
            <Route path="/encarregados" element={<EncarregadosPage />} />
            <Route path="/contratos" element={<ContractsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['ADMIN', 'GERENTE']} />}>
            <Route path="/requisicoes/nova" element={<RequisitionFormPage />} />
            <Route path="/contratos/novo" element={<ContractFormPage />} />
            <Route path="/contratos/:id/editar" element={<ContractFormPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route
              path="/materiais/:id/editar"
              element={<MaterialFormPage />}
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
