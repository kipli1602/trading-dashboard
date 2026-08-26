import Header from '@/components/Header'

export default function PositionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Header currentPage="positions" />
      <main className="min-h-screen bg-dark-bg pb-8">
        <div className="container mx-auto px-4 py-6">
          {children}
        </div>
      </main>
    </>
  )
}