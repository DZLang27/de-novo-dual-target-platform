import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import ProjectCreatePage from './pages/ProjectCreatePage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import TaskDetailPage from './pages/TaskDetailPage'
import MoleculeDetailPage from './pages/MoleculeDetailPage'
import TargetManagerPage from './pages/TargetManagerPage'
import TargetDetailPage from './pages/TargetDetailPage'
import TaskComparePage from './pages/TaskComparePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects/new" element={<ProjectCreatePage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="/molecules/:moleculeId" element={<MoleculeDetailPage />} />
        <Route path="/targets" element={<TargetManagerPage />} />
        <Route path="/targets/:targetId" element={<TargetDetailPage />} />
        <Route path="/compare" element={<TaskComparePage />} />
      </Route>
    </Routes>
  )
}
