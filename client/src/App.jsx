import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import Departments from './pages/Departments';
import Appointments from './pages/Appointments';
import Prescriptions from './pages/Prescriptions';
import GraphExplorer from './pages/GraphExplorer';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');

  const pageTitles = {
    dashboard: 'Executive Hospital Dashboard',
    patients: 'Patient Directory & Electronic Medical Records',
    doctors: 'Doctor Directory & Department Staffing',
    departments: 'Clinical Hospital Departments',
    appointments: 'Patient Outpatient Consultation Appointments',
    prescriptions: 'Clinical Prescriptions & Medication Plans',
    'graph-explorer': 'Neo4j Graph Relationship Explorer',
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard setActivePage={setActivePage} />;
      case 'patients':
        return <Patients />;
      case 'doctors':
        return <Doctors />;
      case 'departments':
        return <Departments />;
      case 'appointments':
        return <Appointments />;
      case 'prescriptions':
        return <Prescriptions />;
      case 'graph-explorer':
        return <GraphExplorer />;
      default:
        return <Dashboard setActivePage={setActivePage} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="main-content">
        <Navbar title={pageTitles[activePage] || 'Smart Hospital'} />
        <main className="content-body">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
