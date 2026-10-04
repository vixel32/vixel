import { useEffect, useState } from 'react';
import { X, Loader2, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, buildWhatsAppUrl } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface OrderFormProps {
  product: Product;
  whatsapp: string;
  isUndangan: boolean;
  isUndanganDigital: boolean;
  isUndanganCetak: boolean;
  onClose: () => void;
}

export default function OrderForm({
  product,
  whatsapp,
  isUndangan,
  isUndanganDigital,
  isUndanganCetak,
  onClose,
}: OrderFormProps) {
  // =========================
  // DATA UMUM
  // =========================
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [eventDate, setEventDate] = useState('');
  const [notes, setNotes] = useState('');

  // =========================
  // DATA MEMPELAI
  // =========================
  const [groomName, setGroomName] = useState('');
  const [brideName, setBrideName] = useState('');

  const [groomNickname, setGroomNickname] = useState('');
  const [brideNickname, setBrideNickname] = useState('');

  const [groomChildOrder, setGroomChildOrder] = useState('');
  const [groomSiblingsCount, setGroomSiblingsCount] = useState('');

  const [brideChildOrder, setBrideChildOrder] = useState('');
  const [brideSiblingsCount, setBrideSiblingsCount] = useState('');

  const [groomPhotoLink, setGroomPhotoLink] = useState('');
  const [bridePhotoLink, setBridePhotoLink] = useState('');

  const [groomFather, setGroomFather] = useState('');
  const [groomMother, setGroomMother] = useState('');

  const [brideFather, setBrideFather] = useState('');
  const [brideMother, setBrideMother] = useState('');

  // =========================
  // AKAD
  // =========================
  const [akadDate, setAkadDate] = useState('');
  const [akadStartTime, setAkadStartTime] = useState('');
  const [akadEndTime, setAkadEndTime] = useState('');
  const [akadVenue, setAkadVenue] = useState('');
  const [akadAddress, setAkadAddress] = useState('');
  const [akadMapsLink, setAkadMapsLink] = useState('');

  // =========================
  // RESEPSI
  // =========================
  const [receptionDate, setReceptionDate] = useState('');
  const [receptionStartTime, setReceptionStartTime] = useState('');
  const [receptionEndTime, setReceptionEndTime] = useState('');
  const [receptionVenue, setReceptionVenue] = useState('');
  const [receptionAddress, setReceptionAddress] = useState('');
  const [receptionMapsLink, setReceptionMapsLink] = useState('');

  // =========================
  // UNDANGAN DIGITAL
  // =========================
  const [bank1Name, setBank1Name] = useState('');
  const [bank1Number, setBank1Number] = useState('');
  const [bank1Owner, setBank1Owner] = useState('');

  const [bank2Name, setBank2Name] = useState('');
  const [bank2Number, setBank2Number] = useState('');
  const [bank2Owner, setBank2Owner] = useState('');

  const [galleryLink, setGalleryLink] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [musicLink, setMusicLink] = useState('');

  const [storyStage1, setStoryStage1] = useState('');
  const [storyStage2, setStoryStage2] = useState('');
  const [storyStage3, setStoryStage3] = useState('');

  // =========================
  // UNDANGAN CETAK
  // =========================
  const [printInviteNames, setPrintInviteNames] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Nomor WhatsApp selalu dikosongkan setiap kali form dibuka.
  useEffect(() => {
    setCustomerPhone('');
  }, []);


  // =========================
  // HELPER
  // =========================
  const formatDate = (date: string) => {
    if (!date) return '-';

    const parsedDate = new Date(date + 'T00:00:00');

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTimeRange = (start: string, end: string) => {
    if (!start && !end) return '-';
    if (start && end) return start + ' - ' + end;
    return start || end;
  };

  const formatChildInfo = (
    childOrder: string,
    siblingsCount: string
  ) => {
    if (!childOrder && !siblingsCount) return '-';

    if (childOrder && siblingsCount) {
      return 'Anak ke-' + childOrder + ' dari ' + siblingsCount + ' bersaudara';
    }

    if (childOrder) {
      return 'Anak ke-' + childOrder;
    }

    return 'Dari ' + siblingsCount + ' bersaudara';
  };

  // =========================
  // SUBMIT
  // =========================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!customerName.trim()) {
      setErrorMessage('Nama pemesan wajib diisi.');
      return;
    }

    if (!customerPhone.trim()) {
      setErrorMessage('Nomor WhatsApp wajib diisi.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Gabungkan data ayah + ibu agar tetap kompatibel
      // dengan struktur database lama.
      const groomParents =
        [groomFather && 'Ayah: ' + groomFather, groomMother && 'Ibu: ' + groomMother]
          .filter(Boolean)
          .join(' | ') || null;

      const brideParents =
        [brideFather && 'Ayah: ' + brideFather, brideMother && 'Ibu: ' + brideMother]
          .filter(Boolean)
          .join(' | ') || null;

      const akadTime =
        formatTimeRange(akadStartTime, akadEndTime) === '-'
          ? null
          : formatTimeRange(akadStartTime, akadEndTime);

      const receptionTime =
        formatTimeRange(receptionStartTime, receptionEndTime) === '-'
          ? null
          : formatTimeRange(receptionStartTime, receptionEndTime);

      // =========================
      // SIMPAN ORDER KE SUPABASE
      // =========================
      const { error: insertError } = await supabase
        .from('orders')
        .insert({
          product_id: product.id,
          product_name: product.name,
          product_price: product.price,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          quantity,
          event_date: isUndangan
            ? receptionDate || akadDate || null
            : eventDate || null,
          notes: notes.trim() || null,

          // Data undangan lama tetap disimpan agar kompatibel.
          groom_name: isUndangan ? groomName.trim() || null : null,
          bride_name: isUndangan ? brideName.trim() || null : null,
          groom_parents: isUndangan ? groomParents : null,
          bride_parents: isUndangan ? brideParents : null,

          akad_venue: isUndangan ? akadVenue.trim() || null : null,
          akad_date: isUndangan ? akadDate || null : null,
          akad_time: isUndangan ? akadTime : null,

          reception_venue: isUndangan
            ? receptionVenue.trim() || null
            : null,
          reception_date: isUndangan ? receptionDate || null : null,
          reception_time: isUndangan ? receptionTime : null,

          // Data mempelai tambahan.
          groom_nickname: isUndangan ? groomNickname.trim() || null : null,
          groom_child_order: isUndangan && groomChildOrder
            ? Number(groomChildOrder)
            : null,
          groom_siblings_count: isUndangan && groomSiblingsCount
            ? Number(groomSiblingsCount)
            : null,
          groom_photo_link: isUndanganDigital
            ? groomPhotoLink.trim() || null
            : null,

          bride_nickname: isUndangan ? brideNickname.trim() || null : null,
          bride_child_order: isUndangan && brideChildOrder
            ? Number(brideChildOrder)
            : null,
          bride_siblings_count: isUndangan && brideSiblingsCount
            ? Number(brideSiblingsCount)
            : null,
          bride_photo_link: isUndanganDigital
            ? bridePhotoLink.trim() || null
            : null,

          groom_father: isUndangan ? groomFather.trim() || null : null,
          groom_mother: isUndangan ? groomMother.trim() || null : null,
          bride_father: isUndangan ? brideFather.trim() || null : null,
          bride_mother: isUndangan ? brideMother.trim() || null : null,

          // Akad lengkap.
          akad_start_time: isUndangan ? akadStartTime || null : null,
          akad_end_time: isUndangan ? akadEndTime || null : null,
          akad_address: isUndangan ? akadAddress.trim() || null : null,
          akad_maps_link: isUndangan ? akadMapsLink.trim() || null : null,

          // Resepsi lengkap.
          reception_start_time: isUndangan
            ? receptionStartTime || null
            : null,
          reception_end_time: isUndangan ? receptionEndTime || null : null,
          reception_address: isUndangan
            ? receptionAddress.trim() || null
            : null,
          reception_maps_link: isUndangan
            ? receptionMapsLink.trim() || null
            : null,

          // Data khusus undangan digital.
          bank1_name: isUndanganDigital ? bank1Name.trim() || null : null,
          bank1_number: isUndanganDigital ? bank1Number.trim() || null : null,
          bank1_owner: isUndanganDigital ? bank1Owner.trim() || null : null,
          bank2_name: isUndanganDigital ? bank2Name.trim() || null : null,
          bank2_number: isUndanganDigital ? bank2Number.trim() || null : null,
          bank2_owner: isUndanganDigital ? bank2Owner.trim() || null : null,
          gallery_link: isUndanganDigital ? galleryLink.trim() || null : null,
          video_link: isUndanganDigital ? videoLink.trim() || null : null,
          music_link: isUndanganDigital ? musicLink.trim() || null : null,
          story_stage1: isUndanganDigital ? storyStage1.trim() || null : null,
          story_stage2: isUndanganDigital ? storyStage2.trim() || null : null,
          story_stage3: isUndanganDigital ? storyStage3.trim() || null : null,

          // Data khusus undangan cetak.
          print_invite_names: isUndanganCetak
            ? printInviteNames.trim() || null
            : null,

          cost_price: product.price,
        });

      if (insertError) {
        throw insertError;
      }

      // =========================
      // BANGUN PESAN WHATSAPP
      // =========================
      const messageParts: string[] = [];

      messageParts.push('Halo Vixel, saya ingin memesan:');
      messageParts.push('');
      messageParts.push('*DATA PESANAN*');
      messageParts.push('Produk: ' + (product.name));
      messageParts.push('Harga: ' + (formatPrice(product.price)));
      messageParts.push('Jumlah: ' + (quantity));

      messageParts.push('');
      messageParts.push('*DATA PEMESAN*');
      messageParts.push('Nama: ' + (customerName));
      messageParts.push('WhatsApp: ' + (customerPhone));

      if (!isUndangan && eventDate) {
        messageParts.push('Tanggal Acara: ' + (formatDate(eventDate)));
      }

      // =========================
      // DATA UNDANGAN
      // =========================
      if (isUndangan) {
        messageParts.push('');
        messageParts.push('*DATA MEMPELAI*');

        messageParts.push('');
        messageParts.push('*MEMPELAI PRIA*');
        messageParts.push('Nama Lengkap: ' + (groomName || '-'));
        messageParts.push('Nama Panggilan: ' + (groomNickname || '-'));
        messageParts.push(
          'Urutan Anak: ' + formatChildInfo(groomChildOrder, groomSiblingsCount)
        );
        messageParts.push('Ayah: ' + (groomFather || '-'));
        messageParts.push('Ibu: ' + (groomMother || '-'));

        // FOTO HANYA UNTUK UNDANGAN DIGITAL
        if (isUndanganDigital) {
          messageParts.push(
            'Link Foto: ' + (groomPhotoLink || '-')
          );
        }

        messageParts.push('');
        messageParts.push('*MEMPELAI WANITA*');
        messageParts.push('Nama Lengkap: ' + (brideName || '-'));
        messageParts.push('Nama Panggilan: ' + (brideNickname || '-'));
        messageParts.push(
          'Urutan Anak: ' + formatChildInfo(brideChildOrder, brideSiblingsCount)
        );
        messageParts.push('Ayah: ' + (brideFather || '-'));
        messageParts.push('Ibu: ' + (brideMother || '-'));

        // FOTO HANYA UNTUK UNDANGAN DIGITAL
        if (isUndanganDigital) {
          messageParts.push(
            'Link Foto: ' + (bridePhotoLink || '-')
          );
        }

        // =========================
        // AKAD
        // =========================
        messageParts.push('');
        messageParts.push('*DATA AKAD*');
        messageParts.push('Tanggal: ' + (formatDate(akadDate)));
        messageParts.push(
          'Waktu: ' + formatTimeRange(akadStartTime, akadEndTime)
        );
        messageParts.push('Tempat: ' + (akadVenue || '-'));
        messageParts.push('Alamat: ' + (akadAddress || '-'));
        messageParts.push('Google Maps: ' + (akadMapsLink || '-'));

        // =========================
        // RESEPSI
        // =========================
        messageParts.push('');
        messageParts.push('*DATA RESEPSI*');
        messageParts.push(
          'Tanggal: ' + formatDate(receptionDate)
        );
        messageParts.push(
          'Waktu: ' + formatTimeRange(receptionStartTime, receptionEndTime)
        );
        messageParts.push(
          'Tempat: ' + (receptionVenue || '-')
        );
        messageParts.push(
          'Alamat: ' + (receptionAddress || '-')
        );
        messageParts.push(
          'Google Maps: ' + (receptionMapsLink || '-')
        );

        // =========================
        // UNDANGAN DIGITAL
        // =========================
        if (isUndanganDigital) {
          messageParts.push('');
          messageParts.push('*DATA UNDANGAN DIGITAL*');

          messageParts.push('');
          messageParts.push('*REKENING / TRANSFER*');

          messageParts.push('Bank 1:');
          messageParts.push('Nama Bank: ' + (bank1Name || '-'));
          messageParts.push('Nomor Rekening: ' + (bank1Number || '-'));
          messageParts.push('Atas Nama: ' + (bank1Owner || '-'));

          messageParts.push('');
          messageParts.push('Bank 2:');
          messageParts.push('Nama Bank: ' + (bank2Name || '-'));
          messageParts.push('Nomor Rekening: ' + (bank2Number || '-'));
          messageParts.push('Atas Nama: ' + (bank2Owner || '-'));

          messageParts.push('');
          messageParts.push('*MEDIA*');
          messageParts.push('Link Gallery: ' + (galleryLink || '-'));
          messageParts.push('Link Video: ' + (videoLink || '-'));
          messageParts.push('Link Musik: ' + (musicLink || '-'));

          messageParts.push('');
          messageParts.push('*CERITA MEMPELAI*');

          messageParts.push('');
          messageParts.push('Tahap 1 - Awal Pertemuan:');
          messageParts.push(storyStage1 || '-');

          messageParts.push('');
          messageParts.push('Tahap 2 - Perjalanan Kisah:');
          messageParts.push(storyStage2 || '-');

          messageParts.push('');
          messageParts.push('Tahap 3 - Menuju Pernikahan:');
          messageParts.push(storyStage3 || '-');
        }

        // =========================
        // UNDANGAN CETAK
        // =========================
        if (isUndanganCetak) {
          messageParts.push('');
          messageParts.push('*TURUT MENGUNDANG*');
          messageParts.push(printInviteNames || '-');
        }
      }

      // =========================
      // CATATAN
      // =========================
      if (notes.trim()) {
        messageParts.push('');
        messageParts.push('*CATATAN TAMBAHAN*');
        messageParts.push(notes.trim());
      }

      messageParts.push('');
      messageParts.push(
        'Mohon dibantu untuk proses pesanan saya. Terima kasih.'
      );

      const whatsappMessage = messageParts.join('\n');
      const whatsappUrl = buildWhatsAppUrl(
        whatsapp,
        whatsappMessage
      );

      // Buka WhatsApp
      window.open(whatsappUrl, '_blank');

      onClose();
    } catch (error) {
      console.error('Order error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat mengirim pesanan.';

      setErrorMessage(
        'Pesanan gagal disimpan. ${message}'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================
  // INPUT CLASS
  // =========================
  const inputClass =
    'w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 sm:px-4';

  const textareaClass =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 resize-none';

  const labelClass =
    'mb-2 block text-sm font-medium text-gray-700';

  const sectionClass =
    'rounded-2xl border border-gray-100 bg-gray-50/70 p-3.5 sm:p-5';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 md:p-6">
      <div className="flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
        {/* =========================
            HEADER
        ========================= */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0 pr-4">
            <h2 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
              Form Pemesanan
            </h2>

            <p className="mt-1 truncate text-sm text-gray-500">
              {product.name}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* =========================
            FORM
        ========================= */}
        <form
          onSubmit={handleSubmit}
          className="min-h-0 overflow-y-auto overscroll-contain px-3.5 py-4 sm:px-6 sm:py-6"
        >
          <div className="space-y-4 sm:space-y-5">
            {/* =========================
                DATA PEMESAN
            ========================= */}
            <section className={sectionClass}>
              <div className="mb-4">
                <h3 className="font-semibold text-gray-900">
                  Data Pemesan
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Isi data kontak yang dapat dihubungi.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Nama Pemesan <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) =>
                      setCustomerName(e.target.value)
                    }
                    placeholder="Nama lengkap"
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Nomor WhatsApp{' '}
                    <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="tel"
                    inputMode="numeric"
                    value={customerPhone}
                    onChange={(e) =>
                      setCustomerPhone(e.target.value)
                    }
                    placeholder="08xxxxxxxxxx"
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Jumlah
                  </label>

                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(
                        Math.max(
                          1,
                          Number(e.target.value) || 1
                        )
                      )
                    }
                    className={inputClass}
                  />
                </div>

                {!isUndangan && (
                  <div className="sm:col-span-2">
                    <label className={labelClass}>
                      Tanggal Acara
                    </label>

                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) =>
                        setEventDate(e.target.value)
                      }
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* =========================
                DATA MEMPELAI
            ========================= */}
            {isUndangan && (
              <>
                <section className={sectionClass}>
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900">
                      Data Mempelai
                    </h3>

                    <p className="mt-1 text-xs text-gray-500">
                      Lengkapi data mempelai pria dan wanita.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    {/* MEMPELAI PRIA */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <h4 className="mb-4 font-semibold text-gray-900">
                        Mempelai Pria
                      </h4>

                      <div className="space-y-4">
                        <div>
                          <label className={labelClass}>
                            Nama Lengkap
                          </label>

                          <input
                            type="text"
                            value={groomName}
                            onChange={(e) =>
                              setGroomName(e.target.value)
                            }
                            placeholder="Nama lengkap mempelai pria"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>
                            Nama Panggilan
                          </label>

                          <input
                            type="text"
                            value={groomNickname}
                            onChange={(e) =>
                              setGroomNickname(e.target.value)
                            }
                            placeholder="Nama panggilan"
                            className={inputClass}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                          <div>
                            <label className={labelClass}>
                              Anak ke-
                            </label>

                            <input
                              type="number"
                              min={1}
                              value={groomChildOrder}
                              onChange={(e) =>
                                setGroomChildOrder(
                                  e.target.value
                                )
                              }
                              placeholder="Contoh: 2"
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label className={labelClass}>
                              Dari berapa bersaudara
                            </label>

                            <input
                              type="number"
                              min={1}
                              value={groomSiblingsCount}
                              onChange={(e) =>
                                setGroomSiblingsCount(
                                  e.target.value
                                )
                              }
                              placeholder="Contoh: 4"
                              className={inputClass}
                            />
                          </div>
                        </div>

                        <div>
                          <label className={labelClass}>
                            Nama Ayah
                          </label>

                          <input
                            type="text"
                            value={groomFather}
                            onChange={(e) =>
                              setGroomFather(e.target.value)
                            }
                            placeholder="Nama ayah mempelai pria"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>
                            Nama Ibu
                          </label>

                          <input
                            type="text"
                            value={groomMother}
                            onChange={(e) =>
                              setGroomMother(e.target.value)
                            }
                            placeholder="Nama ibu mempelai pria"
                            className={inputClass}
                          />
                        </div>

                        {/* FOTO HANYA DIGITAL */}
                        {isUndanganDigital && (
                          <div>
                            <label className={labelClass}>
                              Link Foto Mempelai Pria
                            </label>

                            <input
                              type="url"
                              value={groomPhotoLink}
                              onChange={(e) =>
                                setGroomPhotoLink(
                                  e.target.value
                                )
                              }
                              placeholder="https://..."
                              className={inputClass}
                            />

                            <p className="mt-1.5 text-xs text-gray-400">
                              Khusus undangan digital.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* MEMPELAI WANITA */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <h4 className="mb-4 font-semibold text-gray-900">
                        Mempelai Wanita
                      </h4>

                      <div className="space-y-4">
                        <div>
                          <label className={labelClass}>
                            Nama Lengkap
                          </label>

                          <input
                            type="text"
                            value={brideName}
                            onChange={(e) =>
                              setBrideName(e.target.value)
                            }
                            placeholder="Nama lengkap mempelai wanita"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>
                            Nama Panggilan
                          </label>

                          <input
                            type="text"
                            value={brideNickname}
                            onChange={(e) =>
                              setBrideNickname(e.target.value)
                            }
                            placeholder="Nama panggilan"
                            className={inputClass}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                          <div>
                            <label className={labelClass}>
                              Anak ke-
                            </label>

                            <input
                              type="number"
                              min={1}
                              value={brideChildOrder}
                              onChange={(e) =>
                                setBrideChildOrder(
                                  e.target.value
                                )
                              }
                              placeholder="Contoh: 1"
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label className={labelClass}>
                              Dari berapa bersaudara
                            </label>

                            <input
                              type="number"
                              min={1}
                              value={brideSiblingsCount}
                              onChange={(e) =>
                                setBrideSiblingsCount(
                                  e.target.value
                                )
                              }
                              placeholder="Contoh: 3"
                              className={inputClass}
                            />
                          </div>
                        </div>

                        <div>
                          <label className={labelClass}>
                            Nama Ayah
                          </label>

                          <input
                            type="text"
                            value={brideFather}
                            onChange={(e) =>
                              setBrideFather(e.target.value)
                            }
                            placeholder="Nama ayah mempelai wanita"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>
                            Nama Ibu
                          </label>

                          <input
                            type="text"
                            value={brideMother}
                            onChange={(e) =>
                              setBrideMother(e.target.value)
                            }
                            placeholder="Nama ibu mempelai wanita"
                            className={inputClass}
                          />
                        </div>

                        {/* FOTO HANYA DIGITAL */}
                        {isUndanganDigital && (
                          <div>
                            <label className={labelClass}>
                              Link Foto Mempelai Wanita
                            </label>

                            <input
                              type="url"
                              value={bridePhotoLink}
                              onChange={(e) =>
                                setBridePhotoLink(
                                  e.target.value
                                )
                              }
                              placeholder="https://..."
                              className={inputClass}
                            />

                            <p className="mt-1.5 text-xs text-gray-400">
                              Khusus undangan digital.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* =========================
                    AKAD
                ========================= */}
                <section className={sectionClass}>
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900">
                      Data Akad
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>
                        Tanggal Akad
                      </label>

                      <input
                        type="date"
                        value={akadDate}
                        onChange={(e) =>
                          setAkadDate(e.target.value)
                        }
                        className={inputClass}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                      <div>
                        <label className={labelClass}>
                          Mulai
                        </label>

                        <input
                          type="time"
                          value={akadStartTime}
                          onChange={(e) =>
                            setAkadStartTime(e.target.value)
                          }
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>
                          Selesai
                        </label>

                        <input
                          type="time"
                          value={akadEndTime}
                          onChange={(e) =>
                            setAkadEndTime(e.target.value)
                          }
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>
                        Tempat Akad
                      </label>

                      <input
                        type="text"
                        value={akadVenue}
                        onChange={(e) =>
                          setAkadVenue(e.target.value)
                        }
                        placeholder="Nama tempat"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>
                        Link Google Maps
                      </label>

                      <input
                        type="url"
                        value={akadMapsLink}
                        onChange={(e) =>
                          setAkadMapsLink(e.target.value)
                        }
                        placeholder="https://maps.google.com/..."
                        className={inputClass}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelClass}>
                        Alamat Lengkap
                      </label>

                      <textarea
                        value={akadAddress}
                        onChange={(e) =>
                          setAkadAddress(e.target.value)
                        }
                        placeholder="Alamat lengkap tempat akad"
                        rows={3}
                        className={textareaClass}
                      />
                    </div>
                  </div>
                </section>

                {/* =========================
                    RESEPSI
                ========================= */}
                <section className={sectionClass}>
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900">
                      Data Resepsi
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>
                        Tanggal Resepsi
                      </label>

                      <input
                        type="date"
                        value={receptionDate}
                        onChange={(e) =>
                          setReceptionDate(e.target.value)
                        }
                        className={inputClass}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                      <div>
                        <label className={labelClass}>
                          Mulai
                        </label>

                        <input
                          type="time"
                          value={receptionStartTime}
                          onChange={(e) =>
                            setReceptionStartTime(
                              e.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>
                          Selesai
                        </label>

                        <input
                          type="time"
                          value={receptionEndTime}
                          onChange={(e) =>
                            setReceptionEndTime(
                              e.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>
                        Tempat Resepsi
                      </label>

                      <input
                        type="text"
                        value={receptionVenue}
                        onChange={(e) =>
                          setReceptionVenue(e.target.value)
                        }
                        placeholder="Nama tempat"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>
                        Link Google Maps
                      </label>

                      <input
                        type="url"
                        value={receptionMapsLink}
                        onChange={(e) =>
                          setReceptionMapsLink(
                            e.target.value
                          )
                        }
                        placeholder="https://maps.google.com/..."
                        className={inputClass}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelClass}>
                        Alamat Lengkap
                      </label>

                      <textarea
                        value={receptionAddress}
                        onChange={(e) =>
                          setReceptionAddress(
                            e.target.value
                          )
                        }
                        placeholder="Alamat lengkap tempat resepsi"
                        rows={3}
                        className={textareaClass}
                      />
                    </div>
                  </div>
                </section>

                {/* =========================
                    DIGITAL
                ========================= */}
                {isUndanganDigital && (
                  <>
                    <section className={sectionClass}>
                      <div className="mb-4">
                        <h3 className="font-semibold text-gray-900">
                          Rekening / Wedding Gift
                        </h3>

                        <p className="mt-1 text-xs text-gray-500">
                          Kosongkan jika tidak ingin ditampilkan.
                        </p>
                      </div>

                      <div className="space-y-4 sm:space-y-5">
                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <h4 className="mb-4 font-medium text-gray-900">
                            Rekening 1
                          </h4>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div>
                              <label className={labelClass}>
                                Nama Bank
                              </label>

                              <input
                                type="text"
                                value={bank1Name}
                                onChange={(e) =>
                                  setBank1Name(
                                    e.target.value
                                  )
                                }
                                placeholder="BCA / BRI / Mandiri"
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <label className={labelClass}>
                                Nomor Rekening
                              </label>

                              <input
                                type="text"
                                inputMode="numeric"
                                value={bank1Number}
                                onChange={(e) =>
                                  setBank1Number(
                                    e.target.value
                                  )
                                }
                                placeholder="Nomor rekening"
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <label className={labelClass}>
                                Atas Nama
                              </label>

                              <input
                                type="text"
                                value={bank1Owner}
                                onChange={(e) =>
                                  setBank1Owner(
                                    e.target.value
                                  )
                                }
                                placeholder="Nama pemilik rekening"
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <h4 className="mb-4 font-medium text-gray-900">
                            Rekening 2
                          </h4>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div>
                              <label className={labelClass}>
                                Nama Bank
                              </label>

                              <input
                                type="text"
                                value={bank2Name}
                                onChange={(e) =>
                                  setBank2Name(
                                    e.target.value
                                  )
                                }
                                placeholder="BCA / BRI / Mandiri"
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <label className={labelClass}>
                                Nomor Rekening
                              </label>

                              <input
                                type="text"
                                inputMode="numeric"
                                value={bank2Number}
                                onChange={(e) =>
                                  setBank2Number(
                                    e.target.value
                                  )
                                }
                                placeholder="Nomor rekening"
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <label className={labelClass}>
                                Atas Nama
                              </label>

                              <input
                                type="text"
                                value={bank2Owner}
                                onChange={(e) =>
                                  setBank2Owner(
                                    e.target.value
                                  )
                                }
                                placeholder="Nama pemilik rekening"
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* MEDIA */}
                    <section className={sectionClass}>
                      <div className="mb-4">
                        <h3 className="font-semibold text-gray-900">
                          Media Undangan
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className={labelClass}>
                            Link Gallery Foto
                          </label>

                          <input
                            type="url"
                            value={galleryLink}
                            onChange={(e) =>
                              setGalleryLink(
                                e.target.value
                              )
                            }
                            placeholder="https://..."
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>
                            Link Video
                          </label>

                          <input
                            type="url"
                            value={videoLink}
                            onChange={(e) =>
                              setVideoLink(
                                e.target.value
                              )
                            }
                            placeholder="https://..."
                            className={inputClass}
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className={labelClass}>
                            Link Musik
                          </label>

                          <input
                            type="url"
                            value={musicLink}
                            onChange={(e) =>
                              setMusicLink(
                                e.target.value
                              )
                            }
                            placeholder="https://..."
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </section>

                    {/* CERITA 3 TAHAP */}
                    <section className={sectionClass}>
                      <div className="mb-4">
                        <h3 className="font-semibold text-gray-900">
                          Cerita Mempelai
                        </h3>

                        <p className="mt-1 text-xs text-gray-500">
                          Ceritakan kisah pasangan dalam 3 tahapan.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className={labelClass}>
                            Tahap 1 — Awal Pertemuan
                          </label>

                          <textarea
                            value={storyStage1}
                            onChange={(e) =>
                              setStoryStage1(
                                e.target.value
                              )
                            }
                            placeholder="Ceritakan bagaimana pertama kali bertemu..."
                            rows={4}
                            className={textareaClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>
                            Tahap 2 — Perjalanan Kisah
                          </label>

                          <textarea
                            value={storyStage2}
                            onChange={(e) =>
                              setStoryStage2(
                                e.target.value
                              )
                            }
                            placeholder="Ceritakan perjalanan hubungan kalian..."
                            rows={4}
                            className={textareaClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>
                            Tahap 3 — Menuju Pernikahan
                          </label>

                          <textarea
                            value={storyStage3}
                            onChange={(e) =>
                              setStoryStage3(
                                e.target.value
                              )
                            }
                            placeholder="Ceritakan perjalanan hingga memutuskan untuk menikah..."
                            rows={4}
                            className={textareaClass}
                          />
                        </div>
                      </div>
                    </section>
                  </>
                )}

                {/* =========================
                    CETAK
                ========================= */}
                {isUndanganCetak && (
                  <section className={sectionClass}>
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900">
                        Turut Mengundang
                      </h3>

                      <p className="mt-1 text-xs text-gray-500">
                        Masukkan nama keluarga/tamu yang ingin dicantumkan.
                      </p>
                    </div>

                    <textarea
                      value={printInviteNames}
                      onChange={(e) =>
                        setPrintInviteNames(
                          e.target.value
                        )
                      }
                      placeholder="Contoh:
Bapak A & Ibu B
Bapak C & Ibu D
Keluarga Besar ..."
                      rows={6}
                      className={textareaClass}
                    />
                  </section>
                )}
              </>
            )}

            {/* =========================
                CATATAN
            ========================= */}
            <section className={sectionClass}>
              <div className="mb-4">
                <h3 className="font-semibold text-gray-900">
                  Catatan Tambahan
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Opsional.
                </p>
              </div>

              <textarea
                value={notes}
                onChange={(e) =>
                  setNotes(e.target.value)
                }
                placeholder="Tulis catatan atau permintaan khusus..."
                rows={4}
                className={textareaClass}
              />
            </section>

            {/* =========================
                ERROR
            ========================= */}
            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            {/* =========================
                TOTAL / BUTTON
            ========================= */}
            <div className="rounded-2xl bg-gray-900 p-3.5 text-white sm:p-5">
              <div className="flex flex-col gap-4 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                <div>
                  <p className="text-xs text-gray-400">
                    Total Harga
                  </p>

                  <p className="mt-1 text-xl font-bold">
                    {formatPrice(product.price * quantity)}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 min-[420px]:w-auto sm:px-6"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Pesan Sekarang
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
