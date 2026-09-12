import { useEffect } from 'react';

export default function TestimonialsPage() {
  useEffect(() => {
    // Memuat skrip platform Elfsight secara dinamis saat halaman diakses
    const script = document.createElement('script');
    script.src = 'https://elfsightcdn.com/platform.js';
    script.async = true;
    
    document.body.appendChild(script);

    // Membersihkan skrip jika pengunjung berpindah ke halaman lain
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="bg-cream-50 min-h-screen">
      {/* Bagian Hero Banner atas */}
      <section className="bg-cream-200 py-16">
        <div className="container-page text-center">
          <h1 className="section-title text-3xl font-bold text-charcoal-800">Testimoni Pelanggan</h1>
          <p className="section-subtitle mt-2 text-charcoal-600">
            Kisah nyata dari pelanggan yang mempercayakan momen spesialnya kepada Vixel melalui ulasan Google resmi kami
          </p>
        </div>
      </section>

      {/* Bagian Utama Tempat Menampilkan Google Review Elfsight */}
      <section className="container-page py-16">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-charcoal-100">
          
          {/* Widget Elfsight Resmi Milik Vixel (Rapat menggunakan tanda hubung strip) */}
          <div className="elfsight-app-0af46f80-d34f-4f2d-87ed-3b212932a49d" data-elfsight-app-lazy></div>

        </div>
      </section>
    </div>
  );
}
