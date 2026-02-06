"use client";

import React from 'react';

export default function Page() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'sans-serif',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Studio Projesi</h1>
      <p style={{ fontSize: '1.2rem', color: '#666' }}>
        Sistem başarıyla çalışıyor. Eksik bileşenler (UI/Firebase) temizlendi.
      </p>
      <div style={{ marginTop: '2rem' }}>
        <button style={{
          padding: '10px 20px',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}>
          Test Butonu
        </button>
      </div>
    </div>
  );
}
