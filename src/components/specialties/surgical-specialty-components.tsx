// =====================================================
// REACT COMPONENTS - 4 SURGICAL SPECIALTIES
// React + TypeScript + Tailwind CSS
// =====================================================

import React, { useState } from 'react';
import { Line, Bar } from 'recharts';
import { 
  useROMTracking, 
  useVATracking, 
  useStentRegistry, 
  useSurveillanceCalculator,
  useCalculateBostonScore,
  useOrthopedicEvaluations,
  useCardiacEvaluations,
  useOphthalmicEvaluations,
  useEndoscopyEvaluations,
} from './hooks/surgical-specialty-hooks';

// =====================================================
// ORTHOPEDIC COMPONENTS
// =====================================================

/**
 * ROM Tracker Component with real-time updates and trending chart
 */
export function ROMTracker({ procedureId }: { procedureId: number }) {
  const { data: romData, isLoading } = useROMTracking(procedureId);
  
  if (isLoading) return <div className="animate-pulse">Loading ROM data...</div>;
  if (!romData || romData.length === 0) {
    return <div className="text-gray-500">No ROM measurements recorded yet.</div>;
  }
  
  // Calculate improvement
  const firstMeasurement = romData[0];
  const lastMeasurement = romData[romData.length - 1];
  const improvement = lastMeasurement.degrees - firstMeasurement.degrees;
  const improvementPercent = ((improvement / firstMeasurement.degrees) * 100).toFixed(1);
  
  // Chart data
  const chartData = romData.map(m => ({
    date: new Date(m.measurement_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    degrees: m.degrees,
    pain: m.pain_during_movement || 0,
  }));
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Range of Motion Tracker
        </h2>
        <span className="text-sm text-gray-500">
          {romData[0].joint} - {romData[0].movement_type}
        </span>
      </div>
      
      {/* Timeline */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          {romData.map((measurement, idx) => (
            <div key={measurement.measurement_id} className="flex flex-col items-center">
              <div className="text-xs text-gray-500 mb-1">
                {new Date(measurement.measurement_date).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
              <div className="text-lg font-bold text-green-600">
                {measurement.degrees}°
              </div>
              {idx < romData.length - 1 && (
                <div className="h-1 w-12 bg-green-200 mt-2" />
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Chart */}
      <div className="mb-6">
        <LineChart width={600} height={300} data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis label={{ value: 'Degrees', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="degrees" stroke="#10b981" strokeWidth={2} />
          <Line type="monotone" dataKey="pain" stroke="#ef4444" strokeWidth={2} />
        </LineChart>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-gray-600">Current ROM</div>
          <div className="text-2xl font-bold text-green-600">
            {lastMeasurement.degrees}°
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-gray-600">Improvement</div>
          <div className="text-2xl font-bold text-blue-600">
            +{improvement}° ({improvementPercent}%)
          </div>
        </div>
        <div className="bg-amber-50 rounded-lg p-4">
          <div className="text-sm text-gray-600">Pain Level</div>
          <div className="text-2xl font-bold text-amber-600">
            {lastMeasurement.pain_during_movement || 0}/10
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Orthopedic Surgeon Evaluation Form
 */
export function OrthopedicEvaluationForm({ patientId, procedureId }: { 
  patientId: number; 
  procedureId?: number;
}) {
  const [evaluationType, setEvaluationType] = useState<'initial' | 'followup'>('initial');
  const [formData, setFormData] = useState({
    chief_complaint: '',
    pain_level: 0,
    pain_location: '',
    ambulation_status: 'independent',
    assessment: '',
    plan: '',
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data, error } = await supabase
      .from('orthopedic_evaluation')
      .insert({
        patient_id: patientId,
        procedure_id: procedureId,
        evaluation_type: evaluationType,
        evaluation_date: new Date().toISOString().split('T')[0],
        ...formData,
      });
    
    if (error) {
      console.error('Error saving evaluation:', error);
    } else {
      alert('Evaluation saved successfully!');
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Surgeon Evaluation</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEvaluationType('initial')}
            className={`px-4 py-2 rounded ${evaluationType === 'initial' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
          >
            Initial
          </button>
          <button
            type="button"
            onClick={() => setEvaluationType('followup')}
            className={`px-4 py-2 rounded ${evaluationType === 'followup' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
          >
            Follow-Up
          </button>
        </div>
      </div>
      
      {/* Chief Complaint */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chief Complaint
        </label>
        <textarea
          value={formData.chief_complaint}
          onChange={(e) => setFormData({ ...formData, chief_complaint: e.target.value })}
          className="w-full border-gray-300 rounded-md shadow-sm"
          rows={3}
          required
        />
      </div>
      
      {/* Pain Level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pain Level (0-10)
        </label>
        <input
          type="range"
          min="0"
          max="10"
          value={formData.pain_level}
          onChange={(e) => setFormData({ ...formData, pain_level: parseInt(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-sm text-gray-600">
          <span>No Pain</span>
          <span className="font-bold text-lg">{formData.pain_level}</span>
          <span>Worst Pain</span>
        </div>
      </div>
      
      {/* Assessment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Assessment
        </label>
        <textarea
          value={formData.assessment}
          onChange={(e) => setFormData({ ...formData, assessment: e.target.value })}
          className="w-full border-gray-300 rounded-md shadow-sm"
          rows={4}
          required
        />
      </div>
      
      {/* Plan */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Plan
        </label>
        <textarea
          value={formData.plan}
          onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
          className="w-full border-gray-300 rounded-md shadow-sm"
          rows={4}
          required
        />
      </div>
      
      <button
        type="submit"
        className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700"
      >
        Save Evaluation
      </button>
    </form>
  );
}

// =====================================================
// CARDIAC COMPONENTS
// =====================================================

/**
 * Stent Registry Component
 */
export function StentRegistry({ patientId }: { patientId: number }) {
  const { data: stents, isLoading } = useStentRegistry(patientId);
  
  if (isLoading) return <div className="animate-pulse">Loading stent registry...</div>;
  if (!stents || stents.length === 0) {
    return <div className="text-gray-500">No stents on record.</div>;
  }
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Stent Registry</h2>
      
      <div className="space-y-4">
        {stents.map((stent, idx) => (
          <div key={stent.intervention_id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Stent #{idx + 1} - {stent.target_vessel}
              </h3>
              <span className="text-sm text-gray-500">
                {new Date(stent.cardiac_catheterization.procedure_date).toLocaleDateString()}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Location:</span>
                <span className="ml-2 font-medium">{stent.lesion_location}</span>
              </div>
              <div>
                <span className="text-gray-600">Stenosis:</span>
                <span className="ml-2 font-medium">
                  {stent.pre_stenosis_percent}% → {stent.post_stenosis_percent}%
                </span>
              </div>
              <div>
                <span className="text-gray-600">TIMI Flow:</span>
                <span className="ml-2 font-medium">
                  {stent.pre_timi_flow} → {stent.post_timi_flow}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Type:</span>
                <span className="ml-2 font-medium">{stent.stent_type}</span>
              </div>
            </div>
            
            <div className="mt-4 bg-blue-50 rounded p-3">
              <div className="text-sm font-semibold text-blue-900 mb-2">Stent Details:</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Manufacturer:</span>
                  <span className="ml-2">{stent.stent_manufacturer}</span>
                </div>
                <div>
                  <span className="text-gray-600">Model:</span>
                  <span className="ml-2">{stent.stent_model}</span>
                </div>
                <div>
                  <span className="text-gray-600">Size:</span>
                  <span className="ml-2">{stent.stent_diameter}mm × {stent.stent_length}mm</span>
                </div>
                <div>
                  <span className="text-gray-600">Lot:</span>
                  <span className="ml-2 font-mono text-xs">{stent.stent_lot_number}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Cardiac Surgeon Evaluation Form
 */
export function CardiacEvaluationForm({ patientId, cathId }: { 
  patientId: number; 
  cathId?: number;
}) {
  const [evaluationType, setEvaluationType] = useState<'initial' | 'followup'>('initial');
  const [formData, setFormData] = useState({
    chest_pain: false,
    dyspnea: false,
    nyha_class: 1,
    assessment: '',
    plan: '',
  });
  
  // Similar structure to OrthopedicEvaluationForm
  // Implementation details omitted for brevity
  
  return <div>Cardiac Evaluation Form Component</div>;
}

// =====================================================
// OPHTHALMIC COMPONENTS
// =====================================================

/**
 * Visual Acuity Tracker
 */
export function VATracker({ procedureId, eye }: { procedureId: number; eye: string }) {
  const { data: vaData, isLoading } = useVATracking(procedureId, eye);
  
  if (isLoading) return <div className="animate-pulse">Loading VA data...</div>;
  if (!vaData || vaData.length === 0) {
    return <div className="text-gray-500">No VA measurements recorded yet.</div>;
  }
  
  const chartData = vaData.map(v => ({
    date: new Date(v.measurement_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    logmar: v.va_logmar,
    snellen: v.va_snellen,
  }));
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Visual Acuity Tracker
        </h2>
        <span className="text-sm text-gray-500">Eye: {eye}</span>
      </div>
      
      {/* Chart */}
      <div className="mb-6">
        <LineChart width={600} height={300} data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis 
            label={{ value: 'LogMAR', angle: -90, position: 'insideLeft' }}
            reversed
          />
          <Tooltip />
          <Line type="monotone" dataKey="logmar" stroke="#3b82f6" strokeWidth={2} />
        </LineChart>
      </div>
      
      {/* Latest VA */}
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="text-sm text-gray-600 mb-2">Latest Visual Acuity:</div>
        <div className="text-3xl font-bold text-blue-600">
          {vaData[vaData.length - 1].va_snellen}
        </div>
        <div className="text-sm text-gray-600 mt-1">
          LogMAR: {vaData[vaData.length - 1].va_logmar.toFixed(2)} | 
          Decimal: {vaData[vaData.length - 1].va_decimal.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

/**
 * Ophthalmic Surgeon Evaluation Form
 */
export function OphthalmicEvaluationForm({ patientId, procedureId }: { 
  patientId: number; 
  procedureId?: number;
}) {
  const [evaluationType, setEvaluationType] = useState<'initial' | 'followup'>('initial');
  const [eye, setEye] = useState<'OD' | 'OS' | 'OU'>('OD');
  const [formData, setFormData] = useState({
    va_uncorrected_distance: '',
    iop: 0,
    assessment: '',
    plan: '',
  });
  
  // Similar structure to OrthopedicEvaluationForm
  // Implementation details omitted for brevity
  
  return <div>Ophthalmic Evaluation Form Component</div>;
}

// =====================================================
// ENDOSCOPY COMPONENTS
// =====================================================

/**
 * Boston Bowel Prep Score Calculator
 */
export function BostonScoreCalculator() {
  const [scores, setScores] = useState({
    right_colon: 3,
    transverse_colon: 3,
    left_colon: 3,
  });
  
  const calculateBoston = useCalculateBostonScore();
  
  const handleCalculate = async () => {
    const result = await calculateBoston.mutateAsync(scores);
    console.log('Boston score result:', result);
  };
  
  const total = scores.right_colon + scores.transverse_colon + scores.left_colon;
  const adequate = total >= 6 && scores.right_colon >= 2 && scores.transverse_colon >= 2 && scores.left_colon >= 2;
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Boston Bowel Preparation Scale
      </h2>
      
      {/* Right Colon */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Right Colon (cecum, ascending)
        </label>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((score) => (
            <button
              key={score}
              type="button"
              onClick={() => setScores({ ...scores, right_colon: score })}
              className={`flex-1 py-2 rounded ${
                scores.right_colon === score
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-200'
              }`}
            >
              {score}
            </button>
          ))}
        </div>
      </div>
      
      {/* Transverse Colon */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Transverse Colon
        </label>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((score) => (
            <button
              key={score}
              type="button"
              onClick={() => setScores({ ...scores, transverse_colon: score })}
              className={`flex-1 py-2 rounded ${
                scores.transverse_colon === score
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-200'
              }`}
            >
              {score}
            </button>
          ))}
        </div>
      </div>
      
      {/* Left Colon */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Left Colon (descending, sigmoid, rectum)
        </label>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((score) => (
            <button
              key={score}
              type="button"
              onClick={() => setScores({ ...scores, left_colon: score })}
              className={`flex-1 py-2 rounded ${
                scores.left_colon === score
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-200'
              }`}
            >
              {score}
            </button>
          ))}
        </div>
      </div>
      
      {/* Total Score */}
      <div className={`rounded-lg p-6 text-center ${adequate ? 'bg-green-50' : 'bg-red-50'}`}>
        <div className="text-sm text-gray-600 mb-2">Total Boston Score:</div>
        <div className={`text-5xl font-bold ${adequate ? 'text-green-600' : 'text-red-600'}`}>
          {total}/9
        </div>
        <div className="mt-2 text-sm">
          {adequate ? (
            <span className="text-green-600 font-semibold">✓ Adequate Prep</span>
          ) : (
            <span className="text-red-600 font-semibold">✗ Inadequate Prep</span>
          )}
        </div>
      </div>
      
      <button
        onClick={handleCalculate}
        className="w-full mt-6 bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700"
      >
        Calculate & Save
      </button>
    </div>
  );
}

/**
 * Endoscopy Evaluation Form (Surveillance)
 */
export function EndoscopyEvaluationForm({ patientId, priorReportId }: { 
  patientId: number; 
  priorReportId?: number;
}) {
  const [evaluationType, setEvaluationType] = useState<'surveillance_due' | 'symptom_followup'>('surveillance_due');
  const [formData, setFormData] = useState({
    abdominal_pain: false,
    gi_bleeding: false,
    assessment: '',
    plan: '',
  });
  
  // Similar structure to other evaluation forms
  // Implementation details omitted for brevity
  
  return <div>Endoscopy Evaluation Form Component</div>;
}

// Export all components
export {
  // Orthopedic
  ROMTracker,
  OrthopedicEvaluationForm,
  
  // Cardiac
  StentRegistry,
  CardiacEvaluationForm,
  
  // Ophthalmic
  VATracker,
  OphthalmicEvaluationForm,
  
  // Endoscopy
  BostonScoreCalculator,
  EndoscopyEvaluationForm,
};
