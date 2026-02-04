'use client';

import { useState, useEffect } from 'react';
import styles from './SkillSelector.module.css';

interface Skill {
    id: string;
    name: string;
    category: string;
}

interface SkillSelectorProps {
    title: string;
    description: string;
    selectedSkillIds: string[];
    onChange: (ids: string[]) => void;
    availableSkills: Skill[];
}

export default function SkillSelector({
    title,
    description,
    selectedSkillIds,
    onChange,
    availableSkills
}: SkillSelectorProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Group skills by category
    const groupedSkills = availableSkills.reduce((acc, skill) => {
        if (!acc[skill.category]) {
            acc[skill.category] = [];
        }
        acc[skill.category].push(skill);
        return acc;
    }, {} as Record<string, Skill[]>);

    const toggleSkill = (skillId: string) => {
        if (selectedSkillIds.includes(skillId)) {
            onChange(selectedSkillIds.filter(id => id !== skillId));
        } else {
            onChange([...selectedSkillIds, skillId]);
        }
    };

    const filteredSkills = availableSkills.filter(skill =>
        skill.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <label>{title}</label>
                <span className={styles.description}>{description}</span>
            </div>

            {/* Selected Skills Chips */}
            <div className={styles.chipsContainer}>
                {selectedSkillIds.map(id => {
                    const skill = availableSkills.find(s => s.id === id);
                    if (!skill) return null;
                    return (
                        <div key={id} className={styles.chip}>
                            <span>{skill.name}</span>
                            <button
                                type="button"
                                onClick={() => toggleSkill(id)}
                                className={styles.removeBtn}
                            >
                                ×
                            </button>
                        </div>
                    );
                })}
                <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    + Add Skill
                </button>
            </div>

            {/* Dropdown / Modal */}
            {isOpen && (
                <div className={styles.dropdown}>
                    <input
                        type="text"
                        placeholder="Search skills..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className={styles.searchInput}
                        autoFocus
                    />
                    <div className={styles.list}>
                        {searchTerm ? (
                            filteredSkills.map(skill => (
                                <div
                                    key={skill.id}
                                    className={`${styles.listItem} ${selectedSkillIds.includes(skill.id) ? styles.selected : ''}`}
                                    onClick={() => toggleSkill(skill.id)}
                                >
                                    {skill.name} <span className={styles.category}>{skill.category}</span>
                                </div>
                            ))
                        ) : (
                            Object.entries(groupedSkills).map(([category, skills]) => (
                                <div key={category} className={styles.categoryGroup}>
                                    <h4>{category}</h4>
                                    {skills.map(skill => (
                                        <div
                                            key={skill.id}
                                            className={`${styles.listItem} ${selectedSkillIds.includes(skill.id) ? styles.selected : ''}`}
                                            onClick={() => toggleSkill(skill.id)}
                                        >
                                            {skill.name}
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                    <button type="button" className={styles.closeBtn} onClick={() => setIsOpen(false)}>Done</button>
                </div>
            )}
        </div>
    );
}
