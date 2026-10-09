import { DesignStudio } from "@/components/dashboard/DesignStudio";

export default function DesignPage() {
  return (
    <div className="dash-page wide">
      <div className="dash-head">
        <div>
          <h1>Designverktyg</h1>
          <p>Placera logga och text från brandbooken på produkten. Exportera som bild eller lägg direkt i en offert.</p>
        </div>
      </div>
      <DesignStudio />
    </div>
  );
}
